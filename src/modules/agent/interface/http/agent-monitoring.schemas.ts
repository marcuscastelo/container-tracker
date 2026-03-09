import { z } from 'zod/v4'

export const AgentStatusSchema = z.enum(['CONNECTED', 'DEGRADED', 'DISCONNECTED', 'UNKNOWN'])

export const AgentRealtimeStateSchema = z.enum([
  'SUBSCRIBED',
  'CHANNEL_ERROR',
  'CONNECTING',
  'DISCONNECTED',
  'UNKNOWN',
])

export const AgentProcessingStateSchema = z.enum([
  'idle',
  'leasing',
  'processing',
  'backing_off',
  'unknown',
])

export const AgentLeaseHealthSchema = z.enum(['healthy', 'stale', 'conflict', 'unknown'])

export const AgentBootStatusSchema = z.enum(['starting', 'healthy', 'degraded', 'unknown'])

export const AgentUpdaterStateSchema = z.enum([
  'idle',
  'checking',
  'downloading',
  'ready',
  'draining',
  'applying',
  'rollback',
  'blocked',
  'error',
  'unknown',
])

export const AgentEnrollmentMethodSchema = z.enum(['bootstrap-token', 'manual', 'unknown'])

export const AgentActivityTypeSchema = z.enum([
  'ENROLLED',
  'HEARTBEAT',
  'LEASED_TARGET',
  'SNAPSHOT_INGESTED',
  'REQUEST_FAILED',
  'REALTIME_SUBSCRIBED',
  'REALTIME_CHANNEL_ERROR',
  'LEASE_CONFLICT',
  'UPDATE_CHECKED',
  'UPDATE_AVAILABLE',
  'UPDATE_DOWNLOAD_STARTED',
  'UPDATE_DOWNLOAD_COMPLETED',
  'UPDATE_READY',
  'UPDATE_APPLY_STARTED',
  'UPDATE_APPLY_FAILED',
  'RESTART_FOR_UPDATE',
  'ROLLBACK_EXECUTED',
])

export const AgentActivitySeveritySchema = z.enum(['info', 'warning', 'danger', 'success'])

export const AgentListSortFieldSchema = z.enum([
  'status',
  'tenant',
  'lastSeen',
  'failures',
  'queueLag',
  'activeJobs',
])

export const AgentListSortDirectionSchema = z.enum(['asc', 'desc'])

export const AgentListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: AgentStatusSchema.optional(),
  capability: z.string().trim().min(1).optional(),
  only_problematic: z.coerce.boolean().default(false),
  sort_field: AgentListSortFieldSchema.default('status'),
  sort_dir: AgentListSortDirectionSchema.default('asc'),
})

export const AgentSummaryResponseSchema = z.object({
  agentId: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantName: z.string().min(1),
  hostname: z.string().min(1),
  version: z.string().min(1),
  currentVersion: z.string().min(1),
  desiredVersion: z.string().nullable(),
  updateChannel: z.string().min(1),
  updaterState: AgentUpdaterStateSchema,
  updateAvailable: z.boolean(),
  restartRequired: z.boolean(),
  lastUpdateError: z.string().nullable(),
  updateReadyVersion: z.string().nullable(),
  bootStatus: AgentBootStatusSchema,
  status: AgentStatusSchema,
  enrolledAt: z.string().datetime({ offset: true }).nullable(),
  lastSeenAt: z.string().datetime({ offset: true }).nullable(),
  activeJobs: z.number().int().min(0),
  jobsLastHour: z.number().int().min(0),
  failuresLastHour: z.number().int().min(0),
  avgJobDurationMs: z.number().int().min(0).nullable(),
  queueLagSeconds: z.number().int().min(0).nullable(),
  capabilities: z.array(z.string()),
  realtimeState: AgentRealtimeStateSchema,
})

export const AgentFleetSummaryResponseSchema = z.object({
  totalAgents: z.number().int().min(0),
  connectedCount: z.number().int().min(0),
  degradedCount: z.number().int().min(0),
  disconnectedCount: z.number().int().min(0),
  totalActiveJobs: z.number().int().min(0),
  totalFailuresLastHour: z.number().int().min(0),
  maxQueueLagSeconds: z.number().int().min(0).nullable(),
  tenantCount: z.number().int().min(0),
})

export const AgentListResponseSchema = z.object({
  agents: z.array(AgentSummaryResponseSchema),
  summary: AgentFleetSummaryResponseSchema,
})

export const AgentActivityResponseSchema = z.object({
  id: z.string().uuid(),
  occurredAt: z.string().datetime({ offset: true }),
  type: AgentActivityTypeSchema,
  message: z.string().min(1),
  severity: AgentActivitySeveritySchema,
})

export const AgentDetailResponseSchema = AgentSummaryResponseSchema.extend({
  enrollmentMethod: AgentEnrollmentMethodSchema,
  tokenIdMasked: z.string().nullable(),
  intervalSec: z.number().int().positive().nullable(),
  processingState: AgentProcessingStateSchema,
  leaseHealth: AgentLeaseHealthSchema,
  lastError: z.string().nullable(),
  updaterLastCheckedAt: z.string().datetime({ offset: true }).nullable(),
  restartRequestedAt: z.string().datetime({ offset: true }).nullable(),
  recentActivity: z.array(AgentActivityResponseSchema),
})

export const AgentHeartbeatBodySchema = z.object({
  tenant_id: z.string().uuid(),
  hostname: z.string().trim().min(1).optional(),
  agent_version: z.string().trim().min(1).optional(),
  current_version: z.string().trim().min(1).optional(),
  desired_version: z.string().trim().min(1).nullable().optional(),
  update_ready_version: z.string().trim().min(1).nullable().optional(),
  restart_requested_at: z.string().datetime({ offset: true }).nullable().optional(),
  boot_status: AgentBootStatusSchema.optional(),
  update_state: AgentUpdaterStateSchema.optional(),
  updater_last_checked_at: z.string().datetime({ offset: true }).nullable().optional(),
  updater_last_error: z.string().nullable().optional(),
  realtime_state: AgentRealtimeStateSchema.optional(),
  processing_state: AgentProcessingStateSchema.optional(),
  lease_health: AgentLeaseHealthSchema.optional(),
  active_jobs: z.number().int().min(0).optional(),
  capabilities: z.array(z.string().trim().min(1)).max(32).optional(),
  interval_sec: z.number().int().positive().optional(),
  queue_lag_seconds: z.number().int().min(0).nullable().optional(),
  last_error: z.string().nullable().optional(),
  status: AgentStatusSchema.optional(),
  occurred_at: z.string().datetime({ offset: true }).optional(),
  activity: z
    .array(
      z.object({
        type: AgentActivityTypeSchema,
        message: z.string().min(1),
        severity: AgentActivitySeveritySchema.default('info'),
        metadata: z.record(z.string(), z.unknown()).default({}),
        occurred_at: z.string().datetime({ offset: true }).optional(),
      }),
    )
    .default([]),
})

export const AgentHeartbeatResponseSchema = z.object({
  ok: z.literal(true),
  updatedAt: z.string().datetime({ offset: true }),
})

export const AgentRequestUpdateBodySchema = z.object({
  desired_version: z.string().trim().min(1),
  update_channel: z.string().trim().min(1).default('stable'),
})

export const AgentRequestRestartBodySchema = z.object({}).optional().default({})

export const AgentRequestOperationResponseSchema = z.object({
  ok: z.literal(true),
  agentId: z.string().uuid(),
  requestedAt: z.string().datetime({ offset: true }),
})

export const AgentUpdateManifestResponseSchema = z.object({
  version: z.string().min(1),
  download_url: z.string().url().nullable(),
  checksum: z
    .string()
    .regex(/^[a-f0-9]{64}$/iu)
    .nullable(),
  channel: z.string().min(1),
  published_at: z.string().datetime({ offset: true }).nullable().optional(),
  update_available: z.boolean(),
  desired_version: z.string().nullable(),
  current_version: z.string().min(1),
  update_ready_version: z.string().nullable(),
  restart_required: z.boolean(),
  restart_requested_at: z.string().datetime({ offset: true }).nullable(),
})
