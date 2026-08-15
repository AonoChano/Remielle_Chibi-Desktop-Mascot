const { contextBridge, ipcRenderer } = require('electron');

// NOTE: Keep these channel lists inline in this file.
// Preload scripts run in Electron's sandboxed renderer by default, where
// `require` is a limited polyfill and cannot load local files such as
// `./ipc-channels`. Loading a local module here would make `window.electronAPI`
// undefined and break IPC (pet dragging, panel i18n, settings, etc.).
const SEND_CHANNELS = [
  'drag-pet',
  'open-panel',
  'play-animation',
  'set-mouse-events',
  'set-size',
  'set-locale',
  'toggle-light',
];

const RECEIVE_CHANNELS = [
  'play-animation',
  'apply-scale',
  'locale-changed',
  'toggle-light',
  'cursor-position',
  'eye-tracking-changed',
  'test-mode-changed',
  'always-on-top-changed',
];

const INVOKE_CHANNELS = [
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
];

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, ...args) => {
    if (SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
  on: (channel, callback) => {
    if (RECEIVE_CHANNELS.includes(channel)) {
      const listener = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
    return () => {};
  },
  invoke: (channel, ...args) => {
    if (INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Invalid invoke channel: ${channel}`));
  }
});
