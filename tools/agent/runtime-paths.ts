// biome-ignore-all lint/style/noRestrictedImports: Runtime shim keeps direct relative imports for release bundles.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  resolveAgentConfigDir as resolveCanonicalAgentConfigDir,
  resolveAgentDataDir as resolveCanonicalAgentDataDir,
  resolveLogsDir as resolveCanonicalLogsDir,
  resolveReleaseStatePath as resolveCanonicalReleaseStatePath,
} from './runtime/paths.ts'

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export function resolveDataDir(): string {
  return resolveCanonicalAgentDataDir()
}

export function resolveAgentConfigDir(): string {
  return resolveCanonicalAgentConfigDir()
}

export function resolveAgentDataDir(): string {
  return resolveCanonicalAgentDataDir()
}

export function resolveLogsDir(): string {
  return resolveCanonicalLogsDir()
}

export function resolveReleaseStatePath(): string {
  return resolveCanonicalReleaseStatePath()
}

export function resolveReleasesDir(dataDir: string): string {
  return path.join(dataDir, 'releases')
}

export function resolveCurrentRelease(currentLinkPath: string): string | null {
  try {
    return fs.realpathSync(currentLinkPath)
  } catch {
    return null
  }
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
  const dataDir = resolveDataDir()
  const configPath =
    normalizeOptionalEnv(process.env.DOTENV_PATH) ?? path.join(dataDir, 'config.env')
  const bootstrapPath =
    normalizeOptionalEnv(process.env.BOOTSTRAP_DOTENV_PATH) ?? path.join(dataDir, 'bootstrap.env')

  return {
    dataDir,
    configPath,
    bootstrapPath,
    consumedBootstrapPath: `${bootstrapPath}.consumed`,
    releasesDir: resolveReleasesDir(dataDir),
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
