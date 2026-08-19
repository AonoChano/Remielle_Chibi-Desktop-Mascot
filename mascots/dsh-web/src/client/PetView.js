/**
 * The floating pet view, registered into the shell.overlay slot.
 *
 * - Renders the Spine canvas in a configurable-size host (bottom-right by
 *   default, or wherever the user last dragged it).
 * - Pointer-based drag with capture; a drag that moved > 4px is not a click.
 * - Single click -> cute reaction; double click -> drawing sequence
 *   (the click/dblclick race is resolved with a 260ms single-click timer).
 * - Host-activity feed (see activityStore.js): the engine follows the DSH
 *   session state — thinking while the agent works, pleading while waiting.
 * - Settings (size / light chance / activity link) come from settings.js and
 *   apply immediately; position and visibility persist via localStorage.
 * - The engine lives and dies with `hidden`: hiding unmounts the canvas and
 *   disposes the WebGL context; showing recreates it on a fresh canvas (this
 *   keeps hide/show reliable without a page refresh).
 */
import React from 'react';
import { createPet } from './spine.js';
import { createBehavior } from './behavior.js';
import { mountCss } from './css.js';
import { getHidden, subscribeHidden, subscribePosReset } from './store.js';
import { getActivity, subscribeActivity } from './activityStore.js';
import { getSettings, subscribeSettings } from './settings.js';
import { loadPos, savePos } from './persist.js';

const DRAG_THRESHOLD = 4;
const CLICK_DELAY_MS = 260;

export function PetView() {
  const hostRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const engineRef = React.useRef(null);
  const behaviorRef = React.useRef(null);
  const clickTimerRef = React.useRef(null);
  const draggingRef = React.useRef(false);
  const movedRef = React.useRef(false);
  const lastPointerRef = React.useRef({ x: 0, y: 0 });
  const posRef = React.useRef(null);

  const [hidden, setHiddenState] = React.useState(getHidden());
  const [pos, setPos] = React.useState(loadPos());
  const [assetError, setAssetError] = React.useState(null);
  const [settings, setSettingsState] = React.useState(getSettings());

  React.useEffect(() => mountCss(), []);
  React.useEffect(() => subscribeHidden(setHiddenState), []);
  React.useEffect(() => subscribeSettings(setSettingsState), []);
  React.useEffect(() => subscribePosReset(() => setPos(null)), []);
  React.useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  // Follow the host activity (agent running / waiting) into the behavior.
  React.useEffect(() => subscribeActivity((next) => {
    const behavior = behaviorRef.current;
    if (behavior !== null) behavior.drive(next);
  }), []);

  // Live-resize the skeleton when the config card changes the pet size.
  React.useEffect(() => {
    const engine = engineRef.current;
    if (engine !== null) engine.setSize(settings.size);
  }, [settings.size]);

  // Engine lifecycle tied to visibility: hidden -> dispose; shown -> create.
  // Creation is deferred until the browser is idle (requestIdleCallback, with
  // a timeout fallback) so the page boot never competes with the ~1.2MB Spine
  // asset fetch, the 500KB skeleton JSON parse, and the texture upload.
  React.useEffect(() => {
    if (hidden) return undefined;
    const canvas = canvasRef.current;
    if (canvas === null) return undefined;
    let cancelled = false;
    let idleHandle = null;

    const start = () => {
      if (cancelled) return;
      const behavior = createBehavior({
        lightChance: () => getSettings().lightChance,
      });
      behaviorRef.current = behavior;
      const engine = createPet({
        canvas,
        behavior,
        petSize: settings.size,
        onError: (errors) => {
          const values = Object.values(errors || {});
          setAssetError(String(values[0] ?? 'Spine assets failed to load'));
        },
      });
      engineRef.current = engine;
      behavior.start();
      behavior.drive(getActivity());
    };

    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(start, { timeout: 800 });
    } else {
      idleHandle = window.setTimeout(start, 400);
    }

    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
      } else {
        window.clearTimeout(idleHandle);
      }
      if (clickTimerRef.current !== null) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      if (engineRef.current !== null) {
        engineRef.current.dispose();
        engineRef.current = null;
        behaviorRef.current = null;
      }
    };
  }, [hidden]);

  // Pixel-accurate click-through: only where the character actually draws
  // pixels the host intercepts pointer events. Transparent areas drop
  // pointer-events so clicks reach the page underneath. The probe runs on
  // throttled pointermove and on a slow interval (the animation moves under a
  // static cursor). Pointer mode is applied directly to the host style to
  // avoid re-render churn.
  React.useEffect(() => {
    if (hidden) return undefined;
    const host = hostRef.current;
    if (host === null) return undefined;
    const cursorRefLocal = { x: 0, y: 0, inside: false };
    let lastCheck = 0;

    const applyMode = (interactive) => {
      host.style.pointerEvents = interactive ? 'auto' : 'none';
    };

    const check = (now) => {
      if (draggingRef.current) {
        applyMode(true); // a grabbed pet stays draggable even over its gaps
        return;
      }
      const engine = engineRef.current;
      if (engine === null) {
        applyMode(false);
        return;
      }
      if (!cursorRefLocal.inside) {
        applyMode(false);
        return;
      }
      applyMode(engine.isOpaqueAt(cursorRefLocal.x, cursorRefLocal.y));
    };

    const onMove = (event) => {
      const rect = host.getBoundingClientRect();
      cursorRefLocal.inside =
        event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!cursorRefLocal.inside) return;
      cursorRefLocal.x = event.clientX;
      cursorRefLocal.y = event.clientY;
      const now = Date.now();
      if (now - lastCheck < 50) return; // throttle the GPU read
      lastCheck = now;
      check(now);
    };

    const interval = window.setInterval(() => check(Date.now()), 300);
    window.addEventListener('pointermove', onMove, true);
    applyMode(false); // nothing is clickable until a probe says otherwise
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.clearInterval(interval);
    };
  }, [hidden]);

  function scheduleSingleClick() {
    if (clickTimerRef.current !== null) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      const behavior = behaviorRef.current;
      if (behavior !== null) behavior.singleClick();
    }, CLICK_DELAY_MS);
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    draggingRef.current = true;
    movedRef.current = false;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    const host = hostRef.current;
    if (host !== null && host.setPointerCapture) host.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!draggingRef.current) return;
    const dx = event.clientX - lastPointerRef.current.x;
    const dy = event.clientY - lastPointerRef.current.y;
    if (!movedRef.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    movedRef.current = true;
    const host = hostRef.current;
    if (host === null) return;
    const rect = host.getBoundingClientRect();
    const nx = Math.min(Math.max(rect.left + dx, 0), window.innerWidth - rect.width);
    const ny = Math.min(Math.max(rect.top + dy, 0), window.innerHeight - rect.height);
    setPos({ x: nx, y: ny });
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const host = hostRef.current;
    if (host !== null && host.hasPointerCapture && host.hasPointerCapture(event.pointerId)) {
      host.releasePointerCapture(event.pointerId);
    }
    if (movedRef.current) {
      savePos(posRef.current);
    } else {
      scheduleSingleClick();
    }
  }

  function handleDoubleClick(event) {
    event.preventDefault();
    if (clickTimerRef.current !== null) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    const behavior = behaviorRef.current;
    if (behavior !== null) behavior.doubleClick();
  }

  if (hidden) return null;

  const style = {
    ...(pos === null ? { right: 24, bottom: 24 } : { left: pos.x, top: pos.y }),
    width: settings.size,
    height: settings.size,
  };

  return React.createElement(
    'div',
    {
      ref: hostRef,
      className: 'remi-pet-host',
      style,
      title: '蕾米埃尔',
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onDoubleClick: handleDoubleClick,
    },
    React.createElement('canvas', { ref: canvasRef }),
    assetError === null
      ? null
      : React.createElement('div', { className: 'remi-pet-error' }, assetError),
  );
}
