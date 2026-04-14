import {
  type RuntimeState as RuntimeHealthRecord,
  RuntimeStateSchema,
} from '@agent/core/contracts/runtime-state.contract'
import { readJsonFileWithSchema, writeFileAtomic } from '@agent/state/file-io'
import { serializeRuntimeState } from '@agent/state/runtime-state.mapper'

export type AgentBootStatus = RuntimeHealthRecord['boot_status']

export type AgentUpdateState = RuntimeHealthRecord['update_state']

export type { RuntimeHealthRecord }

export function writeRuntimeHealth(filePath: string, record: RuntimeHealthRecord): void {
  const normalized = RuntimeStateSchema.parse(record)
  writeFileAtomic(filePath, serializeRuntimeState(normalized))
}

export function readRuntimeHealth(filePath: string): RuntimeHealthRecord | null {
  return readJsonFileWithSchema(filePath, RuntimeStateSchema)
}
