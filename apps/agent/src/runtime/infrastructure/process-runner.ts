import type { ChildProcess } from 'node:child_process'
import { resolvePlatformAdapter } from '@agent/platform/platform.adapter'

export function startRuntimeProcess(command: {
  readonly scriptPath: string
  readonly execArgv?: readonly string[]
  readonly env: NodeJS.ProcessEnv
  readonly stdio: 'inherit' | 'pipe'
}): ChildProcess {
  return resolvePlatformAdapter().startRuntime(command)
}

export function stopRuntimeProcess(child: ChildProcess): void {
  resolvePlatformAdapter().stopRuntime({ child })
}

export function restartRuntimeProcess(command: {
  readonly child: ChildProcess
  readonly next: {
    readonly scriptPath: string
    readonly execArgv?: readonly string[]
    readonly env: NodeJS.ProcessEnv
    readonly stdio: 'inherit' | 'pipe'
  }
}): ChildProcess {
  return resolvePlatformAdapter().restartRuntime(command)
}
