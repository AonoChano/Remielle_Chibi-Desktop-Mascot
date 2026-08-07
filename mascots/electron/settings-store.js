'use strict';

const path = require('path');
const fs = require('fs');

const BASE_SIZE = 420; // Reference pet window size (px)

function createSettingsStore(userDataPath) {
  const settingsPath = path.join(userDataPath, 'settings.json');

  function load() {
    try {
      if (fs.existsSync(settingsPath)) {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      }
    } catch (e) {
      console.warn('[settings] Failed to load:', e.message);
    }
    return {};
  }

  function save(partial, options = {}) {
    try {
      const existing = load();
      const merged = { ...existing, ...partial };
      fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.warn('[settings] Failed to save:', e.message);
      if (options.throwOnError) throw e;
      return false;
    }
  }

  function migrate() {
    const saved = load();
    if (saved.size === undefined) return;
    if (saved.petSize === undefined) {
      saved.petSize = saved.size;
    }
    delete saved.size;
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(saved, null, 2), 'utf8');
    } catch (e) {
      console.warn('[settings] Migration write failed:', e.message);
    }
  }

  return { load, save, migrate, settingsPath, BASE_SIZE };
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

module.exports = { createSettingsStore, debounce, BASE_SIZE };
