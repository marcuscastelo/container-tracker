import os from 'node:os'
import path from 'node:path'
import { AGENT_PATH_LAYOUT, resolveAgentPathLayoutPaths } from '@agent/platform/agent-path-layout'
import type { PlatformPathResolution } from '@agent/platform/platform.contract'

export const DEFAULT_WINDOWS_DATA_DIR_NAME = 'ContainerTracker'
export const DEFAULT_WINDOWS_INSTALL_DIR_NAME = 'ContainerTrackerAgent'

export function normalizeOptionalWindowsEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export function resolveWindowsLocalAppData(env: NodeJS.ProcessEnv): string {
  return (
    normalizeOptionalWindowsEnv(env.LOCALAPPDATA) ??
    path.win32.join(os.homedir(), 'AppData', 'Local')
  )
}

export function resolveWindowsDataDir(env: NodeJS.ProcessEnv): string {
  const explicitDataDir = normalizeOptionalWindowsEnv(env.AGENT_DATA_DIR)
  if (explicitDataDir) {
    return explicitDataDir
  }

  return path.win32.join(resolveWindowsLocalAppData(env), DEFAULT_WINDOWS_DATA_DIR_NAME)
}

export function resolveWindowsInstallRoot(env: NodeJS.ProcessEnv): string {
  const explicitInstallRoot = normalizeOptionalWindowsEnv(env.CT_AGENT_INSTALL_ROOT)
  if (explicitInstallRoot) {
    return explicitInstallRoot
  }

  return path.win32.join(
    resolveWindowsLocalAppData(env),
    'Programs',
    DEFAULT_WINDOWS_INSTALL_DIR_NAME,
  )
}

export function resolveWindowsPlatformPaths(env: NodeJS.ProcessEnv): PlatformPathResolution {
  const dataDir = resolveWindowsDataDir(env)
  const bootstrapEnvPath =
    normalizeOptionalWindowsEnv(env.BOOTSTRAP_DOTENV_PATH) ??
    path.win32.join(dataDir, AGENT_PATH_LAYOUT.files.bootstrapEnv)
  const configEnvPath =
    normalizeOptionalWindowsEnv(env.DOTENV_PATH) ??
    path.win32.join(dataDir, AGENT_PATH_LAYOUT.files.configEnv)
  const publicStateDir =
    normalizeOptionalWindowsEnv(env.AGENT_PUBLIC_STATE_DIR) ??
    path.win32.join(dataDir, AGENT_PATH_LAYOUT.directories.publicState)

  return resolveAgentPathLayoutPaths({
    dataDir,
    bootstrapEnvPath,
    publicStateDir,
    configEnvPath,
    joinPath: path.win32.join,
  })
}
