const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, ...args) => {
    const validSendChannels = [
      'drag-pet',
      'open-panel',
      'play-animation',
      'set-expression',
      'set-mouse-events',
      'set-size',
      'set-locale',
      'toggle-light',
      'set-test-mode'
    ];
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
  on: (channel, callback) => {
    const validReceiveChannels = [
      'play-animation',
      'set-expression',
      'apply-scale',
      'locale-changed',
      'toggle-light',
      'cursor-position',
      'eye-tracking-changed',
      'test-mode-changed'
    ];
    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
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
      'set-eye-tracking-enabled'
    ];
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Invalid invoke channel: ${channel}`));
  }
});
