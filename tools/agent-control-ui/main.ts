import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import * as electron from 'electron'
import type { BrowserWindow as ElectronBrowserWindow, Tray as ElectronTray } from 'electron'
import { createAgentControlLocalService } from '@tools/agent/control-core/local-control-service'
import { ensureAgentPathLayout, resolveAgentPathLayout } from '@tools/agent/runtime-paths'
import {
  AgentControlBackendUrlInputSchema,
  AgentControlBlockedVersionsInputSchema,
  AgentControlChannelInputSchema,
  AgentControlConfigPatchInputSchema,
  AgentControlLogsQuerySchema,
  AgentControlReleaseVersionInputSchema,
  agentControlIpcChannels,
} from '@tools/agent-control-ui/ipc'
import { createInstalledLinuxControlService } from '@tools/agent-control-ui/linux-installed-service'
import {
  createWindowLifecycleController,
  setupSingleInstance,
  type UiLaunchMode,
} from '@tools/agent-control-ui/window-controller'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '../../../..')
const { app, BrowserWindow, ipcMain, Menu, Tray } = electron

const launchMode = resolveLaunchMode()
const lifecycle = createWindowLifecycleController({
  mode: launchMode,
})
let mainWindow: ElectronBrowserWindow | null = null
let tray: ElectronTray | null = null
let openWindowRequested = lifecycle.shouldOpenOnReady()

function resolveLaunchMode(): UiLaunchMode {
  return process.env.CT_AGENT_UI_MODE === 'tray' ? 'tray' : 'window'
}

function isInstalledLinuxUi(): boolean {
  return process.platform === 'linux' && process.env.CT_AGENT_UI_INSTALLED === '1'
}

function resolveIconPath(): string | undefined {
  const candidates = [
    process.env.CT_AGENT_UI_ICON_PATH?.trim(),
    path.join(repoRoot, 'public', 'branding', 'logo-light.png'),
    path.join(repoRoot, 'public', 'favicon.ico'),
  ]

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.length === 0) {
      continue
    }
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return undefined
}

function createBridgeService() {
  if (isInstalledLinuxUi()) {
    return createInstalledLinuxControlService()
  }

  const layout = resolveAgentPathLayout()
  ensureAgentPathLayout(layout)
  return createAgentControlLocalService({ layout })
}

function createMainWindow(): ElectronBrowserWindow {
  const iconPath = resolveIconPath()
  const createdWindow = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1180,
    minHeight: 840,
    show: false,
    backgroundColor: '#f2efe8',
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(currentDir, 'preload.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  createdWindow.on('ready-to-show', () => {
    if (openWindowRequested) {
      lifecycle.openWindow(createdWindow)
    }
    if (process.env.AGENT_CONTROL_UI_DEVTOOLS === '1') {
      createdWindow.webContents.openDevTools()
    }
  })
  createdWindow.on('close', (event) => {
    lifecycle.handleWindowClose(event, createdWindow)
  })
  createdWindow.on('closed', () => {
    if (mainWindow === createdWindow) {
      mainWindow = null
    }
  })

  const rendererUrl = process.env.AGENT_CONTROL_UI_RENDERER_URL
  if (rendererUrl) {
    void createdWindow.loadURL(rendererUrl)
  } else {
    void createdWindow.loadFile(path.join(currentDir, 'renderer', 'index.html'))
  }

  return createdWindow
}

function ensureMainWindow(): ElectronBrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow
  }

  mainWindow = createMainWindow()
  return mainWindow
}

function openMainWindow(): void {
  openWindowRequested = true
  lifecycle.openWindow(ensureMainWindow())
}

function createTrayHost(): ElectronTray {
  const trayIconPath = resolveIconPath()
  if (!trayIconPath) {
    throw new Error('Tray icon asset was not found')
  }

  const createdTray = new Tray(trayIconPath)
  createdTray.setToolTip('Container Tracker Agent')
  createdTray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Abrir UI',
        click() {
          openMainWindow()
        },
      },
      {
        label: 'Recarregar',
        click() {
          const existingWindow = mainWindow
          if (existingWindow) {
            existingWindow.webContents.reload()
          }
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Sair',
        click() {
          lifecycle.setQuitting()
          app.quit()
        },
      },
    ]),
  )
  createdTray.on('click', () => {
    openMainWindow()
  })
  createdTray.on('double-click', () => {
    openMainWindow()
  })
  return createdTray
}

function registerIpcHandlers(): void {
  const service = createBridgeService()

  ipcMain.handle(agentControlIpcChannels.getBackendState, async () => {
    return service.getBackendState()
  })
  ipcMain.handle(agentControlIpcChannels.getSnapshot, async () => {
    if ('getAgentOperationalSnapshot' in service) {
      const result = await service.getAgentOperationalSnapshot()
      return result.snapshot
    }

    return service.getSnapshot()
  })
  ipcMain.handle(agentControlIpcChannels.getLogs, async (_event, rawInput) => {
    const parsed = AgentControlLogsQuerySchema.parse(rawInput ?? {})
    return service.getLogs(parsed)
  })
  ipcMain.handle(agentControlIpcChannels.getReleaseInventory, async () => {
    return service.getReleaseInventory()
  })
  ipcMain.handle(agentControlIpcChannels.getPaths, async () => {
    return service.getPaths()
  })
  ipcMain.handle(agentControlIpcChannels.startAgent, async () => service.startAgent())
  ipcMain.handle(agentControlIpcChannels.stopAgent, async () => service.stopAgent())
  ipcMain.handle(agentControlIpcChannels.restartAgent, async () => service.restartAgent())
  ipcMain.handle(agentControlIpcChannels.pauseUpdates, async () => service.pauseUpdates())
  ipcMain.handle(agentControlIpcChannels.resumeUpdates, async () => service.resumeUpdates())
  ipcMain.handle(agentControlIpcChannels.changeChannel, async (_event, rawInput) => {
    const parsed = AgentControlChannelInputSchema.parse(rawInput)
    if ('getAgentOperationalSnapshot' in service) {
      return service.changeChannel(parsed.channel)
    }

    return service.changeChannel(parsed)
  })
  ipcMain.handle(agentControlIpcChannels.setBlockedVersions, async (_event, rawInput) => {
    const parsed = AgentControlBlockedVersionsInputSchema.parse(rawInput)
    if ('getAgentOperationalSnapshot' in service) {
      return service.setBlockedVersions(parsed.versions)
    }

    return service.setBlockedVersions(parsed)
  })
  ipcMain.handle(agentControlIpcChannels.updateConfig, async (_event, rawInput) => {
    const parsed = AgentControlConfigPatchInputSchema.parse(rawInput)
    if ('getAgentOperationalSnapshot' in service) {
      return service.updateConfig(parsed.patch)
    }

    return service.updateConfig(parsed)
  })
  ipcMain.handle(agentControlIpcChannels.setBackendUrl, async (_event, rawInput) => {
    const parsed = AgentControlBackendUrlInputSchema.parse(rawInput)
    return service.setBackendUrl(parsed.backendUrl)
  })
  ipcMain.handle(agentControlIpcChannels.activateRelease, async (_event, rawInput) => {
    const parsed = AgentControlReleaseVersionInputSchema.parse(rawInput)
    if ('getAgentOperationalSnapshot' in service) {
      return service.activateRelease(parsed.version)
    }

    return service.activateRelease(parsed)
  })
  ipcMain.handle(agentControlIpcChannels.rollbackRelease, async () => {
    return service.rollbackRelease()
  })
  ipcMain.handle(agentControlIpcChannels.executeLocalReset, async () => {
    return service.executeLocalReset()
  })
}

const canRun = setupSingleInstance({
  app,
  onSecondInstance() {
    openWindowRequested = true
    if (mainWindow) {
      lifecycle.openWindow(mainWindow)
    }
  },
})

if (canRun) {
  void app.whenReady().then(() => {
    registerIpcHandlers()
    ensureMainWindow()
    if (launchMode === 'tray') {
      tray = createTrayHost()
    } else {
      openMainWindow()
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        ensureMainWindow()
      }
      openMainWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (launchMode !== 'tray' && process.platform !== 'darwin') {
    app.quit()
  }
})
