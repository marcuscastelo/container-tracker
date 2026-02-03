// Preload script - runs in a secure context before the web page loads
// This provides a bridge between the renderer process and Node.js

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Get app version
  getVersion: () => ipcRenderer.invoke('get-version'),
  
  // Platform info
  platform: process.platform,
  
  // Check if running in Electron
  isElectron: true
});

console.log('Electron preload script loaded');
