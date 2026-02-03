const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const { exec } = require('child_process');

let mainWindow = null;
let serverProcess = null;

const SERVER_PORT = 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

// Determine if we're in development or production
const isDev = !app.isPackaged;

/**
 * Check if the server is ready by attempting to connect to the port
 */
function waitForServer(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    function tryConnect() {
      const socket = new net.Socket();

      socket.setTimeout(1000);

      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });

      socket.on('timeout', () => {
        socket.destroy();
        if (Date.now() - startTime < timeout) {
          setTimeout(tryConnect, 500);
        } else {
          reject(new Error('Server startup timeout'));
        }
      });

      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - startTime < timeout) {
          setTimeout(tryConnect, 500);
        } else {
          reject(new Error('Server startup timeout'));
        }
      });

      socket.connect(port, 'localhost');
    }

    tryConnect();
  });
}

/**
 * Start the SolidStart server (only in production)
 * In development, we assume the server is already running via concurrently
 */
function startServer() {
  return new Promise((resolve, reject) => {
    // In development, just wait for the server that's already running
    if (isDev) {
      console.log('Development mode: waiting for existing server...');
      waitForServer(SERVER_PORT)
        .then(() => {
          console.log('Server is ready!');
          resolve();
        })
        .catch(reject);
      return;
    }

    // Production: start the server ourselves
    console.log('Starting SolidStart server...');

    const serverPath = path.join(process.resourcesPath, 'server');

    // In production, the Nitro server is run directly with node
    const nodeExecutable = process.execPath; // Use the bundled Node or system Node
    const serverScript = path.join(serverPath, 'index.mjs');

    console.log(`Server path: ${serverPath}`);
    console.log(`Running: node ${serverScript}`);

    // Kill any existing server process
    serverProcess = spawn('node', [serverScript], {
      cwd: serverPath,
      shell: false,
      env: {
        ...process.env,
        PORT: SERVER_PORT.toString(),
        NODE_ENV: 'production',
        NITRO_PORT: SERVER_PORT.toString()
      }
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`[Server] ${data.toString()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[Server Error] ${data.toString()}`);
    });

    serverProcess.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
      serverProcess = null;
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
      reject(err);
    });

    // Wait for server to be ready
    waitForServer(SERVER_PORT)
      .then(() => {
        console.log('Server is ready!');
        resolve();
      })
      .catch(reject);
  });
}

/**
 * Create the main browser window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    show: false // Don't show until ready
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Stop the server process
 */
function stopServer() {
  if (serverProcess) {
    console.log('Stopping server...');

    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t'])
      } else {
        // Kill process group
        process.kill(-serverProcess.pid, 'SIGTERM')
      }
    } catch (err) {
      if (err.code !== 'ESRCH') {
        throw err
      }
      // ESRCH = process / process group already gone → OK
    } finally {
      serverProcess = null
    }
  }
  killLeftover(SERVER_PORT);
}

function killLeftover(port) {
  if (process.platform === 'win32') {
    // Windows: use netstat to find processes using the port and kill them
    exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
      if (err) {
        console.warn('Could not check for leftover server processes:', err);
        return;
      }
      const lines = stdout.split('\n').filter(Boolean);
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== process.pid.toString()) {
          console.warn(`Killing leftover process on port ${port}: PID ${pid}`);
          spawn('taskkill', ['/pid', pid, '/f', '/t']);
        }
      });
    });
  } else {
    // Linux/macOS: use lsof to find processes using the port and kill them
    exec(`lsof -i :${port} -sTCP:LISTEN -t`, (err, stdout) => {
      if (err) {
        // lsof returns non-zero if nothing is found, that's fine
        return;
      }
      const pids = stdout.split('\n').filter(Boolean);
      pids.forEach(pid => {
        if (pid && pid !== process.pid.toString()) {
          console.warn(`Killing leftover process on port ${port}: PID ${pid}`);
          try {
            process.kill(parseInt(pid), 'SIGTERM');
          } catch (e) {
            console.error(`Failed to kill PID ${pid}:`, e);
          }
        }
      });
    });
  }
  if (process.platform === 'win32') {
    // Windows: use netstat to find processes using the port
    exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
      if (err) {
        console.warn('Could not check for leftover server processes:', err);
        return;
      }
      const lines = stdout.split('\n').filter(Boolean);
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== process.pid.toString()) {
          console.warn(`Leftover process detected on port ${port}: PID ${pid}`);
        }
      });
    });
  } else {
    // Linux/macOS: use lsof to find processes using the port
    exec(`lsof -i :${port} -sTCP:LISTEN -t`, (err, stdout) => {
      if (err) {
        // lsof returns non-zero if nothing is found, that's fine
        return;
      }
      const pids = stdout.split('\n').filter(Boolean);
      pids.forEach(pid => {
        if (pid && pid !== process.pid.toString()) {
          console.warn(`Leftover process detected on port ${port}: PID ${pid}`);
        }
      });
    });
  }
}

// App lifecycle events
app.whenReady().then(async () => {
  try {
    killLeftover(SERVER_PORT);
    await startServer();
    createWindow();
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopServer();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  stopServer();
  app.quit();
});