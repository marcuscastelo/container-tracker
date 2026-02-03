const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  // Check for static client
  const possibleStatic = [
    path.join(__dirname, '..', '.vinxi', 'build', 'client', '_build', 'index.html'),
    path.join(__dirname, '..', 'dist', 'client', 'index.html'),
    path.join(__dirname, '..', 'build', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
  ]
  const firstStatic = possibleStatic.find((p) => fs.existsSync(p))
  if (firstStatic) {
    mainWindow.loadFile(firstStatic).catch(console.error)
    return
  }

  // Find bundled server entries
  const possibleServers = [
    // packaged native server binaries (pkg outputs) - prefer these when available
    path.join(__dirname, '..', 'dist', 'servers', 'server-linux'),
    path.join(__dirname, '..', 'dist', 'servers', 'maersk-linux'),
    path.join(__dirname, '..', 'server', 'index.js'),
    path.join(__dirname, '..', '.vinxi', 'build', 'ssr', 'index.js'),
    path.join(__dirname, '..', '.vinxi', 'build', 'ssr', 'ssr.js'),
    path.join(__dirname, '..', '.vinxi', 'build', 'server-fns', '_server', 'server-fns.js'),
    path.join(__dirname, '..', 'build', 'index.js'),
    path.join(__dirname, '..', 'dist', 'server', 'index.js'),
  ]

  const projectRoot = path.join(__dirname, '..')

  // If packaged, also check for native server binaries placed under resources/servers
  const packagedServerPaths = () => {
    try {
      const rp = process.resourcesPath
      return [
        path.join(rp, 'servers', 'server-linux'),
        path.join(rp, 'servers', 'maersk-linux'),
        path.join(rp, '..', 'servers', 'server-linux'),
        path.join(rp, '..', 'servers', 'maersk-linux'),
        path.join(rp, 'app.asar.unpacked', 'servers', 'server-linux'),
        path.join(rp, 'app.asar.unpacked', 'servers', 'maersk-linux'),
        path.join(rp, 'app.asar', 'servers', 'server-linux'),
        path.join(rp, 'app.asar', 'servers', 'maersk-linux')
      ]
    } catch (e) {
      return []
    }
  }

  // Helper: try multiple locations (dev tree, resources, asarUnpacked) to locate an entry
  const resolveCandidate = (p) => {
    if (fs.existsSync(p)) return p
    try {
      const rel = path.relative(projectRoot, p).replace(/\\/g, '/')
      // check resources path (extraResources copied here)
      const resPath = path.join(process.resourcesPath, rel)
      if (fs.existsSync(resPath)) return resPath
      // check asar unpacked location
      const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', rel)
      if (fs.existsSync(unpacked)) return unpacked
    } catch (e) {}
    return null
  }

  let serverEntry = possibleServers.map(resolveCandidate).find(Boolean)
  const maerskEntryCandidates = [
    path.join(projectRoot, 'server', 'maersk-server.cjs'),
    path.join(projectRoot, 'server', 'maersk-server.js')
  ]
  let maerskEntry = maerskEntryCandidates.map(resolveCandidate).find(Boolean)
  // prefer packaged native servers if present
  const packaged = packagedServerPaths().find((p) => fs.existsSync(p))
  if (packaged) {
    if (packaged.endsWith('maersk-linux')) {
      // maersk-only binary found
      maerskEntry = packaged
    } else {
      // main server binary found
      serverEntry = packaged
    }
  }

  const children = []
  const startProcess = (entry, port) => {
    const { spawn } = require('child_process')
    // If the entry is inside the packaged resources (AppImage/asar), do not attempt to
    // execute it in-place — packaged installations should run the server binary that
    // ships alongside the AppImage or as a separate artifact. Return false so the
    // caller can fallback or the user can run the server manually.
    try {
      if (process.resourcesPath && String(entry).includes(process.resourcesPath)) {
        console.warn('Found server inside packaged resources; do not execute in-place. Please run the external server binary located next to the AppImage or use the run script. Entry:', entry)
        return false
      }

      // Prefer loading in-process for local JS/CJS files (development)
      if (entry.endsWith('.cjs')) {
        try { require(entry); return true } catch (e) { console.warn('require(entry) failed, falling back to spawn:', e) }
      }
      if (entry.endsWith('.js')) {
        try { const { pathToFileURL } = require('url'); import(pathToFileURL(entry).href).then(() => {}).catch(() => {}); return true } catch (e) { console.warn('dynamic import failed, falling back to spawn:', e) }
      }

      const child = spawn(process.execPath, [entry], { cwd: projectRoot, env: { ...process.env, PORT: String(port || process.env.PORT || '3000') }, stdio: 'inherit' })
      child.on('exit', (code, signal) => { if (code !== 0) console.error(`${entry} exited code=${code} signal=${signal}`) })
      children.push(child)
      return true
    } catch (e) {
      console.error('Failed to spawn', entry, e)
      return false
    }
  }

  const waitForUrl = async (url, timeout = 20000, interval = 200) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      try {
        const res = await fetch(url, { method: 'HEAD' })
        if (res && (res.status === 200 || res.status === 204 || res.status === 301 || res.status === 302)) return true
      } catch (e) {}
      await new Promise((r) => setTimeout(r, interval))
    }
    return false
  }

  ;(async () => {
    // Start main server if present
    let started = false
    if (serverEntry) started = startProcess(serverEntry, process.env.PORT || 3000)
    // Also start maersk server separately if present
    if (maerskEntry) startProcess(maerskEntry, process.env.MAERSK_PORT || 4300)

    const port = process.env.PORT || 3000
    const url = `http://localhost:${port}`
    if (started) {
      const ok = await waitForUrl(url, 20000)
      if (ok) {
        mainWindow.loadURL(url).catch(console.error)
        return
      }
    }
    // fallback to trying localhost anyway
    mainWindow.loadURL(url).catch(console.error)
  })()
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
  })
