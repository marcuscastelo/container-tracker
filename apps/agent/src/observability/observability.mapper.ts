import {
  type AgentLogEntry,
  AgentLogEntrySchema,
  type HealthSnapshot,
  HealthSnapshotSchema,
  type HeartbeatPayload,
  HeartbeatPayloadSchema,
} from '@agent/core/contracts/observability.contract'

export function toHealthSnapshot(value: HealthSnapshot): HealthSnapshot {
  return HealthSnapshotSchema.parse(value)
}

export function toHeartbeatPayload(value: HeartbeatPayload): HeartbeatPayload {
  return HeartbeatPayloadSchema.parse(value)
}

export function toAgentLogEntry(value: AgentLogEntry): AgentLogEntry {
  return AgentLogEntrySchema.parse(value)
}
