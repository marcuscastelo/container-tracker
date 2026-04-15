import type { RuntimeState } from '@agent/core/contracts/runtime-state.contract'
import type { PlatformPathResolution } from '@agent/platform/platform.contract'
import { readJsonFileWithSchema, writeFileAtomic } from '@agent/state/file-io'
import { serializeRuntimeState } from '@agent/state/runtime-state.mapper'
import { RuntimeStateSchema } from '@agent/core/contracts/runtime-state.contract'

export function writeRuntimeStateFile(command: {
  readonly paths: PlatformPathResolution
  readonly state: RuntimeState
}): void {
  const normalized = RuntimeStateSchema.parse(command.state)
  writeFileAtomic(command.paths.runtimeStatePath, serializeRuntimeState(normalized))
}

export function readRuntimeStateFile(command: {
  readonly paths: PlatformPathResolution
}): RuntimeState | null {
  return readJsonFileWithSchema(command.paths.runtimeStatePath, RuntimeStateSchema)
}

export function writeRuntimeStateAtPath(filePath: string, state: RuntimeState): void {
  const normalized = RuntimeStateSchema.parse(state)
  writeFileAtomic(filePath, serializeRuntimeState(normalized))
}

export function readRuntimeStateAtPath(filePath: string): RuntimeState | null {
  return readJsonFileWithSchema(filePath, RuntimeStateSchema)
}
