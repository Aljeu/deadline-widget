// electron/preload.js — minimal, safe bridge for the renderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deadlineAPI', {
  baseUrl: 'http://127.0.0.1:8766',
  setAlwaysOnTop: (pinned) => ipcRenderer.invoke('set-always-on-top', pinned),
  getOwnerName: () => ipcRenderer.invoke('get-owner-name'),
  setContentHeight: (h) => ipcRenderer.send('set-content-height', h),
  quit: () => ipcRenderer.send('widget-quit'),
});
