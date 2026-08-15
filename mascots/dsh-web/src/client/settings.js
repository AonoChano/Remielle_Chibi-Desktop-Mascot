/**
 * Reactive pet settings store (size / light chance / activity link),
 * backed by localStorage via persist.js. The plugin-configuration card and
 * the pet view both subscribe here; changes apply immediately.
 */
import {
  loadSize, saveSize,
  loadLightChance, saveLightChance,
  loadActivityEnabled, saveActivityEnabled,
} from './persist.js';

let settings = {
  size: loadSize(),
  lightChance: loadLightChance(),
  activityEnabled: loadActivityEnabled(),
};

const listeners = new Set();

export function getSettings() {
  return settings;
}

export function updateSettings(patch) {
  const next = { ...settings, ...patch };
  saveSize(next.size);
  saveLightChance(next.lightChance);
  saveActivityEnabled(next.activityEnabled);
  settings = next;
  for (const fn of [...listeners]) fn(settings);
}

export function subscribeSettings(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
