import type { RuntimeState as RuntimeHealthRecord } from '@agent/core/contracts/runtime-state.contract'
import {
  readRuntimeStateAtPath,
  writeRuntimeStateAtPath,
} from '@agent/state/infrastructure/runtime-state.file-store'

export function writeRuntimeHealth(filePath: string, record: RuntimeHealthRecord): void {
  writeRuntimeStateAtPath(filePath, record)
}

export function readRuntimeHealth(filePath: string): RuntimeHealthRecord | null {
  return readRuntimeStateAtPath(filePath)
}
