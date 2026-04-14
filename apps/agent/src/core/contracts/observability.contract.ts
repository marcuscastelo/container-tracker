import {
  AgentActivitySeveritySchema,
  AgentBootStatusSchema,
  AgentLeaseHealthSchema,
  AgentProcessingStateSchema,
  AgentRealtimeStateSchema,
  AgentUpdateStateSchema,
} from '@agent/core/types/health-status'
import { AgentProviderSchema } from '@agent/core/types/provider'
import { z } from 'zod/v4'

export const HealthSnapshotSchema = z.object({
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

export type HealthSnapshot = z.infer<typeof HealthSnapshotSchema>

export const HeartbeatActivitySchema = z.object({
  type: z.string().min(1),
  message: z.string().min(1),
  severity: AgentActivitySeveritySchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
  occurred_at: z.string().datetime({ offset: true }).nullable(),
})

export const HeartbeatPayloadSchema = z.object({
  tenant_id: z.string().uuid(),
  hostname: z.string().min(1),
  agent_version: z.string().min(1),
  current_version: z.string().min(1),
  desired_version: z.string().min(1).nullable(),
  update_channel: z.string().min(1),
  update_ready_version: z.string().min(1).nullable(),
  restart_requested_at: z.string().datetime({ offset: true }).nullable(),
  realtime_state: AgentRealtimeStateSchema,
  processing_state: AgentProcessingStateSchema,
  lease_health: AgentLeaseHealthSchema,
  boot_status: AgentBootStatusSchema,
  update_state: AgentUpdateStateSchema,
  updater_last_checked_at: z.string().datetime({ offset: true }).nullable(),
  active_jobs: z.number().int().min(0),
  capabilities: z.array(AgentProviderSchema),
  logs_supported: z.boolean(),
  interval_sec: z.number().int().positive(),
  queue_lag_seconds: z.number().int().min(0).nullable(),
  last_error: z.string().nullable(),
  occurred_at: z.string().datetime({ offset: true }),
  activity: z.array(HeartbeatActivitySchema),
})

export type HeartbeatPayload = z.infer<typeof HeartbeatPayloadSchema>

export const AgentLogEntrySchema = z.object({
  channel: z.enum(['stdout', 'stderr', 'supervisor', 'updater']),
  message: z.string(),
  filePath: z.string().min(1),
  lineNumber: z.number().int().min(1),
})

export type AgentLogEntry = z.infer<typeof AgentLogEntrySchema>
