/**
 * The browser-half Cordis plugin.
 *
 * Mounted by the shell kernel from the built bundle (exports["./client"]):
 * the bundle registers a factory with window.__ModuleLoader__.load() and the
 * factory returns this object. `inject: ['slots']` declares the slots service
 * so the kernel hands it to apply().
 *
 * Beyond the UI seats, apply() tracks the current session:
 *  - `ctx.sessions.list` — the useSessions standard feed (running flags,
 *    pending interactions, background jobs);
 *  - `ctx.sessions.binding(current).session` — the SessionFace
 *    (ObservableSnapshot<ConversationSnapshot>), which carries the streaming
 *    `partial`, `runningCalls` and `pending` fields that distinguish
 *    thinking / writing / waiting.
 * The derived activity is forwarded into activityStore for the pet view.
 */
import React from 'react';
import { PetView } from './PetView.js';
import { ToggleView } from './ToggleView.js';
import { computeActivity, setActivity } from './activityStore.js';

export const plugin = {
  inject: ['slots'],
  apply(ctx) {
    const slots = ctx.get('slots');
    if (slots !== undefined) {
      ctx.effect(() => slots.inject('shell.overlay', () => slots.register(
        { name: 'shell.overlay', id: 'remi-pet', order: 100, label: 'Remielle Pet' },
        () => React.createElement(PetView),
      )), 'remi-pet: pet overlay');
      ctx.effect(() => slots.inject('sidebar.footer.action', () => slots.register(
        { name: 'sidebar.footer.action', id: 'remi-pet-toggle', order: 90, label: 'Remielle Pet Toggle' },
        () => React.createElement(ToggleView),
      )), 'remi-pet: show/hide toggle');
    }

    const sessions = ctx.get('sessions');
    if (sessions !== undefined && sessions.list !== undefined) {
      let tracked = null; // { id, session, unsub } — the binding we follow

      const detach = () => {
        if (tracked !== null) {
          tracked.unsub();
          tracked = null;
        }
      };

      const sync = () => {
        const list = sessions.list.getSnapshot();
        const current = list == null ? undefined : list.current;
        if (current === undefined || current === null) {
          detach();
          setActivity(computeActivity(list, null));
          return;
        }
        if (tracked === null || tracked.id !== current) {
          detach();
          const binding = sessions.binding(current);
          if (binding !== undefined && binding.session !== undefined) {
            tracked = {
              id: current,
              session: binding.session,
              unsub: binding.session.subscribe(sync),
            };
          }
        }
        const conv = tracked === null ? null : tracked.session.getSnapshot();
        setActivity(computeActivity(list, conv));
      };

      sync();
      ctx.effect(() => sessions.list.subscribe(sync), 'remi-pet: session activity (list)');
      ctx.effect(() => () => detach(), 'remi-pet: session activity (binding)');
    }
  },
};
