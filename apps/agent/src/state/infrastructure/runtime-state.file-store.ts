import type { RuntimeState } from '@agent/core/contracts/runtime-state.contract'
import { RuntimeStateSchema } from '@agent/core/contracts/runtime-state.contract'
import type { PlatformPathResolution } from '@agent/platform/platform.contract'
import { readJsonFileWithSchema, writeFileAtomic } from '@agent/state/file-io'
import { serializeRuntimeState } from '@agent/state/runtime-state.mapper'

export function writeRuntimeStateFile(command: {
  readonly paths: PlatformPathResolution
  readonly state: RuntimeState
}): void {
  writeFileAtomic(command.paths.runtimeStatePath, serializeRuntimeState(command.state))
}

export function readRuntimeStateFile(command: {
  readonly paths: PlatformPathResolution
}): RuntimeState | null {
  return readJsonFileWithSchema(command.paths.runtimeStatePath, RuntimeStateSchema)
}

export function writeRuntimeStateAtPath(filePath: string, state: RuntimeState): void {
  writeFileAtomic(filePath, serializeRuntimeState(state))
}

export function readRuntimeStateAtPath(filePath: string): RuntimeState | null {
  return readJsonFileWithSchema(filePath, RuntimeStateSchema)
}
