import {
  AgentBootStatusSchema,
  AgentProcessingStateSchema,
  AgentUpdateStateSchema,
} from '@agent/core/types/health-status'
import { z } from 'zod/v4'

export const RawRuntimeStateFileSchema = z.record(z.string(), z.unknown())

export type RawRuntimeStateFile = z.infer<typeof RawRuntimeStateFileSchema>

export const RuntimeStateSchema = z.object({
  agent_version: z.string().min(1),
  boot_status: AgentBootStatusSchema,
  update_state: AgentUpdateStateSchema,
  last_heartbeat_at: z.string().datetime({ offset: true }).nullable(),
  last_heartbeat_ok_at: z.string().datetime({ offset: true }).nullable(),
  active_jobs: z.number().int().min(0),
  processing_state: AgentProcessingStateSchema,
  updated_at: z.string().datetime({ offset: true }),
  pid: z.number().int().positive(),
})

export type RuntimeState = z.infer<typeof RuntimeStateSchema>
