import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createAgentControlLocalService } from '@tools/agent/control-core/local-control-service'
import { ensureAgentPathLayout, resolveAgentPathLayout } from '@tools/agent/runtime-paths'
import {
  AgentControlBlockedVersionsInputSchema,
  AgentControlChannelInputSchema,
  AgentControlConfigPatchInputSchema,
  AgentControlLogsQuerySchema,
  AgentControlReleaseVersionInputSchema,
  agentControlIpcChannels,
} from '@tools/agent-control-ui/ipc'
import type { BrowserWindow as ElectronBrowserWindow } from 'electron'

const require = createRequire(import.meta.url)
const electron: typeof import('electron') = require('electron')
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const { app, BrowserWindow, ipcMain } = electron

function createMainWindow(): ElectronBrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1180,
    minHeight: 840,
    show: false,
    backgroundColor: '#f2efe8',
    webPreferences: {
      preload: path.join(currentDir, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (process.env.AGENT_CONTROL_UI_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools()
    }
  })

  const rendererUrl = process.env.AGENT_CONTROL_UI_RENDERER_URL
  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(path.join(currentDir, 'renderer', 'index.html'))
  }

  return mainWindow
}

function registerIpcHandlers(): void {
  const layout = resolveAgentPathLayout()
  ensureAgentPathLayout(layout)
  const service = createAgentControlLocalService({ layout })

  ipcMain.handle(agentControlIpcChannels.getSnapshot, async () => {
    const result = await service.getAgentOperationalSnapshot()
    return result.snapshot
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
    return service.changeChannel(parsed.channel)
  })
  ipcMain.handle(agentControlIpcChannels.setBlockedVersions, async (_event, rawInput) => {
    const parsed = AgentControlBlockedVersionsInputSchema.parse(rawInput)
    return service.setBlockedVersions(parsed.versions)
  })
  ipcMain.handle(agentControlIpcChannels.updateConfig, async (_event, rawInput) => {
    const parsed = AgentControlConfigPatchInputSchema.parse(rawInput)
    return service.updateConfig(parsed.patch)
  })
  ipcMain.handle(agentControlIpcChannels.activateRelease, async (_event, rawInput) => {
    const parsed = AgentControlReleaseVersionInputSchema.parse(rawInput)
    return service.activateRelease(parsed.version)
  })
  ipcMain.handle(agentControlIpcChannels.rollbackRelease, async () => {
    return service.rollbackRelease()
  })
  ipcMain.handle(agentControlIpcChannels.executeLocalReset, async () => {
    return service.executeLocalReset()
  })
}

void app.whenReady().then(() => {
  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
