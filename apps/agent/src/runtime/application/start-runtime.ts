import type { ChildProcess } from 'node:child_process'
import { startRuntimeProcess } from '@agent/runtime/infrastructure/process-runner'

export function startRuntime(command: {
  readonly scriptPath: string
  readonly execArgv?: readonly string[]
  readonly env: NodeJS.ProcessEnv
  readonly stdio: 'inherit' | 'pipe'
}): ChildProcess {
  return startRuntimeProcess(command)
}
