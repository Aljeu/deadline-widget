// electron/preload.js — minimal, safe bridge for the renderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deadlineAPI', {
  baseUrl: 'http://127.0.0.1:8766',
  setAlwaysOnTop: (pinned) => ipcRenderer.invoke('set-always-on-top', pinned),
  quit: () => ipcRenderer.send('widget-quit'),
});
