import {
  type AgentOperationalSnapshot,
  AgentOperationalSnapshotSchema,
} from '@tools/agent/control-core/contracts'

export const ControlStateSnapshotSchema = AgentOperationalSnapshotSchema

export type ControlStateSnapshot = AgentOperationalSnapshot
