// electron/preload.js — minimal, safe bridge for the renderer.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('deadlineAPI', {
  baseUrl: 'http://127.0.0.1:8766',
  quit: () => require('electron').ipcRenderer.send('widget-quit'),
});
