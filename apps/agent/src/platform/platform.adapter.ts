import process from 'node:process'
import type {
  PlatformAdapter as ContractPlatformAdapter,
  PlatformProcessHandle,
} from '@agent/core/contracts/platform.contract'

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

export function resolvePlatformContractAdapter(command?: {
  readonly platform?: NodeJS.Platform
  readonly arch?: string
}): ContractPlatformAdapter {
  const legacyAdapter = resolvePlatformAdapter(command)

  return {
    key: legacyAdapter.key,
    resolvePaths: (input) => legacyAdapter.resolvePaths(input),
    startRuntime: (input): PlatformProcessHandle => {
      const child = legacyAdapter.startRuntime({
        scriptPath: input.scriptPath,
        execArgv: input.execArgv,
        env: input.env,
        stdio: input.stdio,
      })

      return {
        pid: child.pid,
        child,
      }
    },
    stopRuntime: (input) => {
      legacyAdapter.stopRuntime({ child: input.handle.child })
    },
    restartRuntime: (input): PlatformProcessHandle => {
      const child = legacyAdapter.restartRuntime({
        child: input.handle.child,
        next: {
          scriptPath: input.next.scriptPath,
          execArgv: input.next.execArgv,
          env: input.next.env,
          stdio: input.next.stdio,
        },
      })

      return {
        pid: child.pid,
        child,
      }
    },
  }
}

// biome-ignore lint/style/noRestrictedImports: Platform runtime needs direct relative imports for portable release bundles.
export type { AgentPlatformAdapter, AgentPlatformKey } from './platform.types.ts'
