// biome-ignore-all lint/style/noRestrictedImports: Runtime shim keeps direct relative imports for release bundles.
import process from 'node:process'
import { LINUX_SYSTEM_DATA_DIR } from '@agent/platform/linux.adapter'
import { resolvePlatformAdapter } from '@agent/platform/platform.adapter'
import type { AgentPathLayout } from './config.contract.ts'

function resolveCurrentAdapter() {
  return resolvePlatformAdapter()
}

export function resolveDataDir(): string {
  return resolveCurrentAdapter().resolvePaths({ env: process.env, cwd: process.cwd() }).dataDir
}

export function resolveReleasesDir(dataDir: string): string {
  return resolveCurrentAdapter().resolvePaths({
    env: {
      ...process.env,
      AGENT_DATA_DIR: dataDir,
    },
    cwd: process.cwd(),
  }).releasesDir
}

export function resolveCurrentRelease(currentPath: string): string | null {
  return resolveCurrentAdapter().readSymlinkOrPointer({ pointerPath: currentPath })
}

export function resolveAgentPathLayout(): AgentPathLayout {
  return resolveCurrentAdapter().resolvePaths({ env: process.env, cwd: process.cwd() })
}

export function resolveInstalledLinuxAgentPathLayout(): AgentPathLayout {
  const envWithInstalledDefault: NodeJS.ProcessEnv = {
    ...process.env,
    AGENT_DATA_DIR: process.env.AGENT_DATA_DIR?.trim() || LINUX_SYSTEM_DATA_DIR,
  }
  return resolvePlatformAdapter({ platform: 'linux', arch: process.arch }).resolvePaths({
    env: envWithInstalledDefault,
    cwd: process.cwd(),
  })
}

export function ensureAgentPathLayout(layout: AgentPathLayout): void {
  resolveCurrentAdapter().ensureDirectories({ paths: layout })
}
