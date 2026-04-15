import type { ChildProcess } from 'node:child_process'
import { stopRuntimeProcess } from '@agent/runtime/infrastructure/process-runner'

export function stopRuntime(child: ChildProcess): void {
  stopRuntimeProcess(child)
}
