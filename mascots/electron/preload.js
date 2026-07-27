const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, ...args) => {
    const validSendChannels = [
      'drag-pet',
      'open-panel',
      'play-animation',
      'set-outfit',
      'set-expression'
    ];
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
  on: (channel, callback) => {
    const validReceiveChannels = [
      'play-animation',
      'set-outfit',
      'set-expression'
    ];
    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  }
});
