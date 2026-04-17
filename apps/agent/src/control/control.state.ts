import {
  type AgentOperationalSnapshot,
  AgentOperationalSnapshotSchema,
} from '@agent/control-core/contracts'

export const ControlStateSnapshotSchema = AgentOperationalSnapshotSchema

export type ControlStateSnapshot = AgentOperationalSnapshot
