/**
 * The browser-half Cordis plugin.
 *
 * Mounted by the shell kernel from the built bundle (exports["./client"]):
 * the bundle registers a factory with window.__ModuleLoader__.load() and the
 * factory returns this object. `inject: ['slots']` declares the slots service
 * so the kernel hands it to apply().
 *
 * UI seats:
 *  - `shell.overlay` — the floating pet;
 *  - `sidebar.footer.action` — the show/hide toggle;
 *  - `settings.plugin.item` — the pet's configuration card in
 *    Settings -> Plugins -> 插件配置 (self-contained, localStorage-backed).
 *
 * Beyond the UI, apply() tracks the current session:
 *  - `ctx.sessions.list` — the useSessions standard feed (running flags,
 *    pending interactions, background jobs);
 *  - `ctx.sessions.binding(current).session` — the SessionFace
 *    (ObservableSnapshot<ConversationSnapshot>), which carries the streaming
 *    `partial`, `runningCalls` and `pending` fields that distinguish
 *    thinking / writing / waiting.
 * The derived activity is forwarded into activityStore for the pet view,
 * unless the user disabled the state link in the config card.
 */
import React from 'react';
import { PetView } from './PetView.js';
import { ToggleView } from './ToggleView.js';
import { ConfigCard } from './ConfigCard.js';
import { computeActivity, setActivity } from './activityStore.js';
import { ACTIVITY } from './behavior.js';
import { getSettings, subscribeSettings } from './settings.js';

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
      ctx.effect(() => slots.inject('settings.plugin.item', () => slots.register(
        { name: 'settings.plugin.item', id: 'remi-pet', order: 30, label: '蕾米宠物' },
        () => React.createElement(ConfigCard),
      )), 'remi-pet: plugin config card');
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
        let activity = ACTIVITY.IDLE;
        if (current !== undefined && current !== null) {
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
          activity = computeActivity(list, conv);
        } else {
          detach();
        }
        setActivity(getSettings().activityEnabled ? activity : ACTIVITY.IDLE);
      };

      sync();
      ctx.effect(() => sessions.list.subscribe(sync), 'remi-pet: session activity (list)');
      ctx.effect(() => subscribeSettings(sync), 'remi-pet: settings -> activity');
      ctx.effect(() => () => detach(), 'remi-pet: session activity (binding)');
    }
  },
};
