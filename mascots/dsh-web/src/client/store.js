/**
 * In-memory hidden-state store shared by PetView and the sidebar toggle.
 * localStorage is the durable source of truth; this module is the notifier.
 * Also carries a position-reset broadcast (fired by the config card's reset).
 */
import { loadHidden, saveHidden, clearPos } from './persist.js';

let hidden = loadHidden();
const listeners = new Set();
const posResetListeners = new Set();

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

/** Clear the saved position and notify the pet view to return to the corner. */
export function resetPos() {
  clearPos();
  for (const fn of [...posResetListeners]) fn();
}

export function subscribePosReset(fn) {
  posResetListeners.add(fn);
  return () => {
    posResetListeners.delete(fn);
  };
}
