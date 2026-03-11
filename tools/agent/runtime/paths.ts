import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// biome-ignore lint/style/noRestrictedImports: Runtime path resolver needs direct relative imports in release bundles.
import { resolvePlatformAdapter } from '../platform/platform.adapter.ts'

const LINUX_SYSTEM_DATA_DIR = '/var/lib/container-tracker-agent'
const LINUX_CONFIG_DIR = '/etc/container-tracker-agent'
const DEV_FALLBACK_DIR_NAME = '.agent-runtime'

export type ResolveAgentDataDirCommand = {
  readonly env: NodeJS.ProcessEnv
  readonly platform: NodeJS.Platform
  readonly cwd: string
  readonly resolvePlatformDataDir: (env: NodeJS.ProcessEnv) => string
  readonly canUseLinuxSystemDir: (candidate: string) => boolean
}

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function canUseLinuxSystemDir(candidate: string): boolean {
  try {
    fs.mkdirSync(candidate, { recursive: true })
    fs.accessSync(candidate, fs.constants.R_OK | fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

function resolvePlatformDataDir(env: NodeJS.ProcessEnv): string {
  return resolvePlatformAdapter().resolvePaths({ env }).dataDir
}

export function resolveAgentDataDirFrom(command: ResolveAgentDataDirCommand): string {
  const dataDirFromEnv = normalizeOptionalEnv(command.env.AGENT_DATA_DIR)
  if (dataDirFromEnv) {
    return dataDirFromEnv
  }

  if (command.platform === 'linux') {
    if (command.canUseLinuxSystemDir(LINUX_SYSTEM_DATA_DIR)) {
      return LINUX_SYSTEM_DATA_DIR
    }

    return path.resolve(command.cwd, DEV_FALLBACK_DIR_NAME)
  }

  return command.resolvePlatformDataDir(command.env)
}

export function resolveAgentDataDir(): string {
  return resolveAgentDataDirFrom({
    env: process.env,
    platform: process.platform,
    cwd: process.cwd(),
    resolvePlatformDataDir,
    canUseLinuxSystemDir,
  })
}

export function resolveAgentConfigDir(): string {
  const configDirFromEnv = normalizeOptionalEnv(process.env.AGENT_CONFIG_DIR)
  if (configDirFromEnv) {
    return configDirFromEnv
  }

  if (process.platform === 'linux') {
    return LINUX_CONFIG_DIR
  }

  return resolveAgentDataDir()
}

export function resolveLogsDir(): string {
  return path.join(resolveAgentDataDir(), 'logs')
}

export function resolveReleaseStatePath(): string {
  return path.join(resolveAgentDataDir(), 'release-state.json')
}
