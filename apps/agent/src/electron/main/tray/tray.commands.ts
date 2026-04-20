import type {
  AgentControlBackendState,
  AgentControlCommandResult,
  AgentControlPaths,
  AgentOperationalSnapshot,
  AgentReleaseInventory,
} from '@agent/control-core/contracts'
import type { AgentTrayAction } from '@agent/electron/main/tray/tray-state'

export type AgentTrayRuntimePort = {
  readonly getBackendState: () => Promise<AgentControlBackendState>
  readonly getSnapshot: () => Promise<AgentOperationalSnapshot>
  readonly getReleaseInventory: () => Promise<AgentReleaseInventory>
  readonly getPaths: () => Promise<AgentControlPaths>
  readonly restartAgent: () => Promise<AgentControlCommandResult>
  readonly checkForUpdates: () => Promise<AgentControlCommandResult>
}

export type AgentTrayShell = {
  readonly openPath: (path: string) => Promise<string>
  readonly openExternal: (url: string) => Promise<void>
}

export type AgentTrayApp = {
  readonly quit: () => void
}

export type AgentTrayCommandDeps = {
  readonly port: AgentTrayRuntimePort
  readonly shell: AgentTrayShell
  readonly app: AgentTrayApp
  readonly openWindow: () => void
  readonly setQuitting: () => void
  readonly notify: (message: string) => void
}

async function openDashboard(deps: AgentTrayCommandDeps): Promise<void> {
  const backendState = await deps.port.getBackendState()
  if (backendState.backendUrl === null) {
    deps.notify('Dashboard URL is unavailable until the agent is enrolled.')
    return
  }

  await deps.shell.openExternal(backendState.backendUrl)
}

async function openLogsFolder(deps: AgentTrayCommandDeps): Promise<void> {
  const paths = await deps.port.getPaths()
  const errorMessage = await deps.shell.openPath(paths.logsDir)
  if (errorMessage.length > 0) {
    deps.notify(errorMessage)
  }
}

async function restartAgent(deps: AgentTrayCommandDeps): Promise<void> {
  const result = await deps.port.restartAgent()
  deps.notify(result.message)
}

async function checkForUpdates(deps: AgentTrayCommandDeps): Promise<void> {
  const result = await deps.port.checkForUpdates()
  deps.notify(result.message)
}

export async function executeAgentTrayAction(
  action: AgentTrayAction,
  deps: AgentTrayCommandDeps,
): Promise<void> {
  if (action === 'open-dashboard') {
    await openDashboard(deps)
    return
  }

  if (action === 'open-logs') {
    await openLogsFolder(deps)
    return
  }

  if (action === 'restart-agent') {
    await restartAgent(deps)
    return
  }

  if (action === 'check-for-updates') {
    await checkForUpdates(deps)
    return
  }

  if (action === 'open-window') {
    deps.openWindow()
    return
  }

  deps.setQuitting()
  deps.app.quit()
}
