/**
 * In-memory hidden-state store shared by PetView and the sidebar toggle.
 * localStorage is the durable source of truth; this module is the notifier.
 */
import { loadHidden, saveHidden } from './persist.js';

let hidden = loadHidden();
const listeners = new Set();

export function getHidden() {
  return hidden;
}

export function setHidden(value) {
  hidden = Boolean(value);
  saveHidden(hidden);
  for (const fn of [...listeners]) fn(hidden);
}

export function subscribeHidden(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
