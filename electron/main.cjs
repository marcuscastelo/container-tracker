const electron = require('electron');
const { BrowserWindow } = electron;
const path = require('path');

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // during dev the dev server should be started by the npm script (we use wait-on)
    const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
    mainWindow.loadURL(devUrl).catch((e) => {
      console.error('Failed to load dev URL', e);
    });
    mainWindow.webContents.openDevTools();
  } else {
    // production: load the built client index.html. Adjust path as needed after build.
    const indexHtml = path.join(__dirname, '..', 'dist', 'client', 'index.html');
    // fallback to common build paths
    const fallback = path.join(__dirname, '..', 'build', 'index.html');

    const fs = require('fs');
    if (fs.existsSync(indexHtml)) {
      mainWindow.loadFile(indexHtml).catch(console.error);
    } else if (fs.existsSync(fallback)) {
      mainWindow.loadFile(fallback).catch(console.error);
    } else {
      // Last resort: try to load a local server on 3000
      mainWindow.loadURL('http://localhost:3000').catch(console.error);
    }
  }
}

// use electron.app to avoid redeclaring an identifier named `app` in environments
// where the module might be executed in a scope that already has `app` defined.
const app = electron.app;

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// graceful exit in dev when using Electron with certain environments
if (isDev) {
  process.on('SIGTERM', () => app.quit());
  process.on('SIGHUP', () => app.quit());
}
