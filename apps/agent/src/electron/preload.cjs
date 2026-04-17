const { contextBridge, ipcRenderer } = require('electron')

const agentControlIpcChannels = {
  getBackendState: 'agent-control/get-backend-state',
  getSnapshot: 'agent-control/get-snapshot',
  getLogs: 'agent-control/get-logs',
  getReleaseInventory: 'agent-control/get-release-inventory',
  getPaths: 'agent-control/get-paths',
  startAgent: 'agent-control/start-agent',
  stopAgent: 'agent-control/stop-agent',
  restartAgent: 'agent-control/restart-agent',
  checkForUpdates: 'agent-control/check-for-updates',
  pauseUpdates: 'agent-control/pause-updates',
  resumeUpdates: 'agent-control/resume-updates',
  changeChannel: 'agent-control/change-channel',
  setBlockedVersions: 'agent-control/set-blocked-versions',
  updateConfig: 'agent-control/update-config',
  setBackendUrl: 'agent-control/set-backend-url',
  activateRelease: 'agent-control/activate-release',
  rollbackRelease: 'agent-control/rollback-release',
  executeLocalReset: 'agent-control/execute-local-reset',
}

const agentControl = {
  getBackendState() {
    return ipcRenderer.invoke(agentControlIpcChannels.getBackendState)
  },
  getSnapshot() {
    return ipcRenderer.invoke(agentControlIpcChannels.getSnapshot)
  },
  getLogs(query) {
    return ipcRenderer.invoke(agentControlIpcChannels.getLogs, query ?? {})
  },
  getReleaseInventory() {
    return ipcRenderer.invoke(agentControlIpcChannels.getReleaseInventory)
  },
  getPaths() {
    return ipcRenderer.invoke(agentControlIpcChannels.getPaths)
  },
  startAgent() {
    return ipcRenderer.invoke(agentControlIpcChannels.startAgent)
  },
  stopAgent() {
    return ipcRenderer.invoke(agentControlIpcChannels.stopAgent)
  },
  restartAgent() {
    return ipcRenderer.invoke(agentControlIpcChannels.restartAgent)
  },
  checkForUpdates() {
    return ipcRenderer.invoke(agentControlIpcChannels.checkForUpdates)
  },
  pauseUpdates() {
    return ipcRenderer.invoke(agentControlIpcChannels.pauseUpdates)
  },
  resumeUpdates() {
    return ipcRenderer.invoke(agentControlIpcChannels.resumeUpdates)
  },
  changeChannel(input) {
    return ipcRenderer.invoke(agentControlIpcChannels.changeChannel, input)
  },
  setBlockedVersions(input) {
    return ipcRenderer.invoke(agentControlIpcChannels.setBlockedVersions, input)
  },
  updateConfig(input) {
    return ipcRenderer.invoke(agentControlIpcChannels.updateConfig, input)
  },
  setBackendUrl(input) {
    return ipcRenderer.invoke(agentControlIpcChannels.setBackendUrl, input)
  },
  activateRelease(input) {
    return ipcRenderer.invoke(agentControlIpcChannels.activateRelease, input)
  },
  rollbackRelease() {
    return ipcRenderer.invoke(agentControlIpcChannels.rollbackRelease)
  },
  executeLocalReset() {
    return ipcRenderer.invoke(agentControlIpcChannels.executeLocalReset)
  },
}

contextBridge.exposeInMainWorld('agentControl', agentControl)
contextBridge.exposeInMainWorld('agentControlMeta', {
  logsRequireAction: false,
  installedMode: process.env.CT_AGENT_UI_INSTALLED === '1',
})
