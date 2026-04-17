import type { RuntimeState } from '@agent/core/contracts/runtime-state.contract'
import {
  readRuntimeStateAtPath,
  writeRuntimeStateAtPath,
} from '@agent/state/infrastructure/runtime-state.file-store'

export function writeRuntimeState(filePath: string, state: RuntimeState): void {
  writeRuntimeStateAtPath(filePath, state)
}

export function readRuntimeState(filePath: string): RuntimeState | null {
  return readRuntimeStateAtPath(filePath)
}
