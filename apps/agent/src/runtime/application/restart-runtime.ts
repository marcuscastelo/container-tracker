import type { ChildProcess } from 'node:child_process'
import { restartRuntimeProcess } from '@agent/runtime/infrastructure/process-runner'

export function restartRuntime(command: {
  readonly child: ChildProcess
  readonly next: {
    readonly scriptPath: string
    readonly execArgv?: readonly string[]
    readonly env: NodeJS.ProcessEnv
    readonly stdio: 'inherit' | 'pipe'
  }
}): ChildProcess {
  return restartRuntimeProcess(command)
}
