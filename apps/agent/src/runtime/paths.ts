import { resolveAgentPathLayout } from '@agent/config/resolve-agent-paths'

export function resolveAgentDataDir(): string {
  return resolveAgentPathLayout().dataDir
}

export function resolveAgentConfigDir(): string {
  return resolveAgentPathLayout().dataDir
}

export function resolveLogsDir(): string {
  return resolveAgentPathLayout().logsDir
}

export function resolveReleaseStatePath(): string {
  return resolveAgentPathLayout().releaseStatePath
}

export function resolveAgentPublicStateDir(): string {
  return resolveAgentPathLayout().publicStateDir
}

export function resolveAgentPublicStatePath(): string {
  return resolveAgentPathLayout().publicStatePath
}

export function resolveAgentPublicBackendStatePath(): string {
  return resolveAgentPathLayout().publicBackendStatePath
}

export function resolveAgentPublicLogsPath(): string {
  return resolveAgentPathLayout().publicLogsPath
}
