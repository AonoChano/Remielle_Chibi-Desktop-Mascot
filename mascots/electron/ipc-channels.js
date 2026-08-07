'use strict';

// Single source of truth for all IPC channel names.
// Used by main.js (handlers), preload.js (whitelist), and tests.

const SEND_CHANNELS = Object.freeze([
  'drag-pet',
  'open-panel',
  'play-animation',
  'set-mouse-events',
  'set-size',
  'set-locale',
  'toggle-light',
]);

const RECEIVE_CHANNELS = Object.freeze([
  'play-animation',
  'apply-scale',
  'locale-changed',
  'toggle-light',
  'cursor-position',
  'eye-tracking-changed',
  'test-mode-changed',
  'always-on-top-changed',
]);

const INVOKE_CHANNELS = Object.freeze([
  'get-locales',
  'get-locale-dict',
  'get-current-locale',
  'open-external',
  'load-settings',
  'save-settings',
  'get-eye-tracking-enabled',
  'set-eye-tracking-enabled',
  'get-test-mode',
  'set-test-mode',
  'reset-pet-position',
  'get-always-on-top',
  'set-always-on-top',
]);

module.exports = {
  SEND_CHANNELS,
  RECEIVE_CHANNELS,
  INVOKE_CHANNELS,
};
