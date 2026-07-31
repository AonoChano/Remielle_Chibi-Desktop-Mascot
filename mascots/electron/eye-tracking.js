(function initEyeTracking(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EyeTracking = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createEyeTracking() {
  'use strict';

  const NORMALIZATION_DISTANCE = 1.5;
  // MAX_X / MAX_Y are in WORLD-space units (approximately screen pixels).
  // The renderer transforms these to local bone space via the parent bone's
  // world matrix, correcting for the ~17° parent rotation and 0.15 root scale.
  const MAX_X = 12;
  const MAX_Y = 8;
  const SMOOTHING_HALF_LIFE = 0.08;
  const MAX_SMOOTHING_DELTA = 0.25;

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function computeEyeTarget(sample) {
    if (!sample || sample.enabled === false || sample.hasSample === false) {
      return { x: 0, y: 0 };
    }

    const values = [
      sample.cursorX,
      sample.cursorY,
      sample.centerX,
      sample.centerY,
      sample.width,
      sample.height,
    ];
    if (!values.every(isFiniteNumber) || sample.width <= 0 || sample.height <= 0) {
      return { x: 0, y: 0 };
    }

    let nx = (sample.cursorX - sample.centerX) /
      (sample.width * NORMALIZATION_DISTANCE);
    let ny = -(sample.cursorY - sample.centerY) /
      (sample.height * NORMALIZATION_DISTANCE);
    const length = Math.hypot(nx, ny);
    if (length > 1) {
      nx /= length;
      ny /= length;
    }

    return {
      x: nx === 0 ? 0 : nx * MAX_X,
      y: ny === 0 ? 0 : ny * MAX_Y,
    };
  }

  function sanitizeOffset(offset) {
    if (!offset) return { x: 0, y: 0 };
    return {
      x: isFiniteNumber(offset.x) ? offset.x : 0,
      y: isFiniteNumber(offset.y) ? offset.y : 0,
    };
  }

  function smoothEyeOffset(current, target, deltaSeconds) {
    const safeCurrent = sanitizeOffset(current);
    if (!isFiniteNumber(deltaSeconds) || deltaSeconds <= 0) {
      return safeCurrent;
    }

    const safeTarget = sanitizeOffset(target);
    const safeDelta = Math.min(deltaSeconds, MAX_SMOOTHING_DELTA);
    const alpha = 1 - Math.pow(2, -safeDelta / SMOOTHING_HALF_LIFE);
    return {
      x: safeCurrent.x + (safeTarget.x - safeCurrent.x) * alpha,
      y: safeCurrent.y + (safeTarget.y - safeCurrent.y) * alpha,
    };
  }

  return {
    computeEyeTarget,
    smoothEyeOffset,
    constants: Object.freeze({
      NORMALIZATION_DISTANCE,
      MAX_X,
      MAX_Y,
      SMOOTHING_HALF_LIFE,
      MAX_SMOOTHING_DELTA,
    }),
  };
}));
