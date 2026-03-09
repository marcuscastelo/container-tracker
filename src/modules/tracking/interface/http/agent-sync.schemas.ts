import z from 'zod/v4'

const AgentProviderSchema = z.enum(['maersk', 'msc', 'cmacgm'])

const SyncRequestStatusSchema = z.enum(['PENDING', 'LEASED', 'DONE', 'FAILED'])

export const GetAgentTargetsQuerySchema = z.object({
  tenant_id: z.string().uuid('tenant_id must be a UUID'),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

const AgentTargetSchema = z.object({
  sync_request_id: z.string().uuid(),
  provider: AgentProviderSchema,
  ref_type: z.literal('container'),
  ref: z.string().min(1),
})

export const GetAgentTargetsResponseSchema = z.object({
  targets: z.array(AgentTargetSchema),
  leased_until: z.string().nullable(),
  queue_lag_seconds: z.number().int().min(0).nullable(),
})

export const IngestSnapshotBodySchema = z.object({
  tenant_id: z.string().uuid('tenant_id must be a UUID'),
  provider: AgentProviderSchema,
  ref: z.object({
    type: z.literal('container'),
    value: z.string().min(1),
  }),
  observed_at: z.string().datetime({ offset: true }),
  raw: z.unknown(),
  meta: z.record(z.string(), z.unknown()).default({}),
  sync_request_id: z.string().uuid(),
})

export const IngestSnapshotAcceptedResponseSchema = z.object({
  ok: z.literal(true),
  snapshot_id: z.string().uuid(),
})

export const IngestLeaseConflictResponseSchema = z.object({
  error: z.literal('lease_conflict'),
  snapshot_id: z.string().uuid().optional(),
})

export const SyncRequestRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  provider: AgentProviderSchema,
  ref_type: z.literal('container'),
  ref_value: z.string().min(1),
  status: SyncRequestStatusSchema,
  priority: z.number().int(),
  leased_by: z.string().nullable(),
  leased_until: z.string().nullable(),
  attempts: z.number().int(),
  last_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type SyncRequestRow = z.infer<typeof SyncRequestRowSchema>
