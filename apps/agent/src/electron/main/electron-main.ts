import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createBootstrapControlService } from '@agent/bootstrap/create-control-service'
import {
  AgentControlBackendUrlInputSchema,
  AgentControlBlockedVersionsInputSchema,
  AgentControlChannelInputSchema,
  AgentControlConfigPatchInputSchema,
  AgentControlLogsQuerySchema,
  AgentControlReleaseVersionInputSchema,
  agentControlIpcChannels,
} from '@agent/electron/ipc'
import { createInstalledLinuxControlService } from '@agent/electron/main/installed-linux-control-service'
import type { AgentTrayRuntimePort } from '@agent/electron/main/tray/tray.commands'
import { type AgentTrayHost, createAgentTrayHost } from '@agent/electron/main/tray/tray-host'
import {
  createWindowLifecycleController,
  setupSingleInstance,
  type UiLaunchMode,
} from '@agent/electron/main/window-controller'
import { isLinuxPlatform, isMacPlatform, isWindowsPlatform } from '@agent/platform/os-branching'
import {
  app,
  BrowserWindow,
  type BrowserWindow as ElectronBrowserWindow,
  ipcMain,
  shell,
  Tray,
} from 'electron'

const currentDir =
  typeof __dirname === 'string' ? __dirname : path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '../../../../..')

const launchMode = resolveLaunchMode()
const lifecycle = createWindowLifecycleController({
  mode: launchMode,
})
let mainWindow: ElectronBrowserWindow | null = null
let trayHost: AgentTrayHost | null = null
let openWindowRequested = lifecycle.shouldOpenOnReady()
const WINDOWS_TRAY_GUID = '0F1AE8D1-7B19-4B14-9A17-2EF197BBD5AA'

function resolveLaunchMode(): UiLaunchMode {
  return process.env.CT_AGENT_UI_MODE === 'tray' ? 'tray' : 'window'
}

function normalizeOptionalEnv(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function resolveControlUiUserDataDir(): string | null {
  return normalizeOptionalEnv(process.env.CT_AGENT_UI_USER_DATA_DIR)
}

function shouldDisableSingleInstanceLock(): boolean {
  return normalizeOptionalEnv(process.env.CT_AGENT_UI_DISABLE_SINGLE_INSTANCE_LOCK) === '1'
}

function configureControlUiUserDataDir(): void {
  const userDataDir = resolveControlUiUserDataDir()
  if (userDataDir === null) {
    return
  }

  fs.mkdirSync(userDataDir, { recursive: true })
  app.setPath('userData', userDataDir)
}

function isInstalledLinuxUi(): boolean {
  return isLinuxPlatform() && process.env.CT_AGENT_UI_INSTALLED === '1'
}

function resolveIconPath(): string | undefined {
  const candidates = [
    process.env.CT_AGENT_UI_ICON_PATH?.trim(),
    process.env.CT_AGENT_INSTALL_ROOT
      ? path.join(process.env.CT_AGENT_INSTALL_ROOT, 'app', 'assets', 'tray.ico')
      : undefined,
    path.join(repoRoot, 'apps', 'agent', 'src', 'installer', 'resources', 'tray.ico'),
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

  return createBootstrapControlService()
}

function resolveTrayIconDir(iconPath: string): string {
  const explicitIconDir = process.env.CT_AGENT_UI_ICON_DIR?.trim()
  if (explicitIconDir) {
    return explicitIconDir
  }

  return path.dirname(iconPath)
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
      preload: path.resolve(currentDir, '../preload.cjs'),
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
    void createdWindow.loadFile(path.resolve(currentDir, '../renderer/index.html'))
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

function createTrayRuntimePort(
  service: ReturnType<typeof createBridgeService>,
): AgentTrayRuntimePort {
  return {
    async getBackendState() {
      return await service.getBackendState()
    },
    async getSnapshot() {
      if ('getAgentOperationalSnapshot' in service) {
        const result = await service.getAgentOperationalSnapshot()
        return result.snapshot
      }

      return service.getSnapshot()
    },
    async getReleaseInventory() {
      return await service.getReleaseInventory()
    },
    async getPaths() {
      return await service.getPaths()
    },
    async restartAgent() {
      return await service.restartAgent()
    },
    async checkForUpdates() {
      if ('checkForUpdates' in service) {
        return await service.checkForUpdates()
      }

      throw new Error('Update checks are unavailable in this installed control mode.')
    },
  }
}

function createTrayHost(service: ReturnType<typeof createBridgeService>): AgentTrayHost {
  const trayIconPath = resolveIconPath()
  if (!trayIconPath) {
    throw new Error('Tray icon asset was not found')
  }

  const createdTray = isWindowsPlatform()
    ? new Tray(trayIconPath, WINDOWS_TRAY_GUID)
    : new Tray(trayIconPath)
  return createAgentTrayHost({
    tray: createdTray,
    port: createTrayRuntimePort(service),
    shell,
    app,
    iconDir: resolveTrayIconDir(trayIconPath),
    fallbackIconPath: trayIconPath,
    openWindow: openMainWindow,
    setQuitting() {
      lifecycle.setQuitting()
    },
  })
}

function registerIpcHandlers(service: ReturnType<typeof createBridgeService>): void {
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
  ipcMain.handle(agentControlIpcChannels.checkForUpdates, async () => {
    if ('checkForUpdates' in service) {
      return service.checkForUpdates()
    }

    throw new Error('Update checks are unavailable in this installed control mode.')
  })
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

configureControlUiUserDataDir()

const canRun = shouldDisableSingleInstanceLock()
  ? true
  : setupSingleInstance({
      app,
      onSecondInstance() {
        openWindowRequested = true
        trayHost?.refresh()
        if (mainWindow) {
          lifecycle.openWindow(mainWindow)
        }
      },
    })

if (canRun) {
  void app.whenReady().then(() => {
    const service = createBridgeService()
    registerIpcHandlers(service)
    if (launchMode === 'tray') {
      if (!isWindowsPlatform()) {
        ensureMainWindow()
      }
      trayHost = createTrayHost(service)
    } else {
      ensureMainWindow()
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
  if (launchMode !== 'tray' && !isMacPlatform()) {
    app.quit()
  }
})
