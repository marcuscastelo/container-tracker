import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_DATA_DIR_NAME = 'ContainerTracker'

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function resolveDefaultDataDir(): string {
  const localAppData = normalizeOptionalEnv(process.env.LOCALAPPDATA)
  if (localAppData) {
    return path.win32.join(localAppData, DEFAULT_DATA_DIR_NAME)
  }

  return path.win32.join(os.homedir(), 'AppData', 'Local', DEFAULT_DATA_DIR_NAME)
}

export type AgentPathLayout = {
  readonly dataDir: string
  readonly configPath: string
  readonly bootstrapPath: string
  readonly consumedBootstrapPath: string
  readonly releasesDir: string
  readonly downloadsDir: string
  readonly logsDir: string
  readonly currentLinkPath: string
  readonly previousLinkPath: string
  readonly releaseStatePath: string
  readonly runtimeHealthPath: string
  readonly supervisorControlPath: string
  readonly pendingActivityPath: string
}

export function resolveAgentPathLayout(): AgentPathLayout {
  const dataDir = normalizeOptionalEnv(process.env.AGENT_DATA_DIR) ?? resolveDefaultDataDir()
  const configPath =
    normalizeOptionalEnv(process.env.DOTENV_PATH) ?? path.join(dataDir, 'config.env')
  const bootstrapPath =
    normalizeOptionalEnv(process.env.BOOTSTRAP_DOTENV_PATH) ?? path.join(dataDir, 'bootstrap.env')

  return {
    dataDir,
    configPath,
    bootstrapPath,
    consumedBootstrapPath: `${bootstrapPath}.consumed`,
    releasesDir: path.join(dataDir, 'releases'),
    downloadsDir: path.join(dataDir, 'downloads'),
    logsDir: path.join(dataDir, 'logs'),
    currentLinkPath: path.join(dataDir, 'current'),
    previousLinkPath: path.join(dataDir, 'previous'),
    releaseStatePath: path.join(dataDir, 'release-state.json'),
    runtimeHealthPath: path.join(dataDir, 'runtime-health.json'),
    supervisorControlPath: path.join(dataDir, 'supervisor-control.json'),
    pendingActivityPath: path.join(dataDir, 'pending-activity-events.json'),
  }
}

export function ensureAgentPathLayout(layout: AgentPathLayout): void {
  fs.mkdirSync(layout.dataDir, { recursive: true })
  fs.mkdirSync(layout.releasesDir, { recursive: true })
  fs.mkdirSync(layout.downloadsDir, { recursive: true })
  fs.mkdirSync(layout.logsDir, { recursive: true })
}
