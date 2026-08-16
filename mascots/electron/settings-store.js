'use strict';

const path = require('path');
const fs = require('fs');

const BASE_SIZE = 420; // Reference pet window size (px)
const MIN_PET_SIZE = 64;
const MAX_PET_SIZE = 2048;

function normalizePetSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size)) return BASE_SIZE;
  if (size < MIN_PET_SIZE || size > MAX_PET_SIZE) return BASE_SIZE;
  return Math.round(size);
}

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
      if (merged.petSize !== undefined) {
        merged.petSize = normalizePetSize(merged.petSize);
      }
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
    let changed = false;

    if (saved.size !== undefined) {
      if (saved.petSize === undefined) {
        saved.petSize = saved.size;
      }
      delete saved.size;
      changed = true;
    }

    if (saved.petSize !== undefined) {
      const normalized = normalizePetSize(saved.petSize);
      if (normalized !== saved.petSize) {
        saved.petSize = normalized;
        changed = true;
      }
    }

    if (changed) {
      try {
        fs.writeFileSync(settingsPath, JSON.stringify(saved, null, 2), 'utf8');
      } catch (e) {
        console.warn('[settings] Migration write failed:', e.message);
      }
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
