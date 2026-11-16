const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('api', {
  loadBible: (id) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', id + '.json'), 'utf8')),
  loadBooks: () => require('./books.js'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  getDisplays: () => ipcRenderer.invoke('displays:get'),
  send: (state) => ipcRenderer.send('projection:state', state),
  toggleProjection: (open) => ipcRenderer.invoke('projection:toggle', open),
  toggleFullscreen: () => ipcRenderer.invoke('projection:fullscreen'),
  pickImage: () => ipcRenderer.invoke('image:pick'),
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
  onProjectionStatus: (cb) => ipcRenderer.on('projection:status', (_e, s) => cb(s)),
  projectionReady: () => ipcRenderer.send('projection:ready'),
});
