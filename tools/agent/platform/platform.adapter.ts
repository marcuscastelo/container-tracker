import process from 'node:process'

// biome-ignore lint/style/noRestrictedImports: Platform runtime needs direct relative imports for portable release bundles.
import { linuxPlatformAdapter } from './linux.adapter.ts'
// biome-ignore lint/style/noRestrictedImports: Platform runtime needs direct relative imports for portable release bundles.
import type { AgentPlatformAdapter, AgentPlatformKey } from './platform.types.ts'
// biome-ignore lint/style/noRestrictedImports: Platform runtime needs direct relative imports for portable release bundles.
import { windowsPlatformAdapter } from './windows.adapter.ts'

function normalizeArch(arch: string): 'x64' | 'other' {
  return arch === 'x64' ? 'x64' : 'other'
}

export function resolveAgentPlatformKey(command?: {
  readonly platform?: NodeJS.Platform
  readonly arch?: string
}): AgentPlatformKey {
  const platform = command?.platform ?? process.platform
  const arch = normalizeArch(command?.arch ?? process.arch)

  if (arch !== 'x64') {
    throw new Error(
      `unsupported architecture for agent update runtime: ${command?.arch ?? process.arch}`,
    )
  }

  return platform === 'win32' ? 'windows-x64' : 'linux-x64'
}

export function resolvePlatformAdapter(command?: {
  readonly platform?: NodeJS.Platform
  readonly arch?: string
}): AgentPlatformAdapter {
  const key = resolveAgentPlatformKey(command)
  if (key === 'windows-x64') {
    return windowsPlatformAdapter
  }

  return linuxPlatformAdapter
}

// biome-ignore lint/style/noRestrictedImports: Platform runtime needs direct relative imports for portable release bundles.
export type { AgentPlatformAdapter, AgentPlatformKey } from './platform.types.ts'
