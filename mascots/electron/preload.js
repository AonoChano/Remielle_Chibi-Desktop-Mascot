const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, ...args) => {
    const validSendChannels = [
      'drag-pet',
      'open-panel',
      'play-animation',
      'set-mouse-events',
      'set-size',
      'set-locale',
      'toggle-light'
    ];
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
  on: (channel, callback) => {
    const validReceiveChannels = [
      'play-animation',
      'apply-scale',
      'locale-changed',
      'toggle-light',
      'cursor-position',
      'eye-tracking-changed',
      'test-mode-changed',
      'always-on-top-changed'
    ];
    if (validReceiveChannels.includes(channel)) {
      const listener = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
    return () => {};
  },
  invoke: (channel, ...args) => {
    const validInvokeChannels = [
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
      'set-always-on-top'
    ];
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Invalid invoke channel: ${channel}`));
  }
});
