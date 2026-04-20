import { AgentProviderSchema } from '@agent/core/types/provider'
import { z } from 'zod/v4'

export const BackendSyncJobDTOSchema = z
  .object({
    sync_request_id: z.string().uuid(),
    provider: AgentProviderSchema,
    ref_type: z.literal('container'),
    ref: z.string().min(1),
  })
  .strict()

export type BackendSyncJobDTO = z.infer<typeof BackendSyncJobDTOSchema>

export const BackendSyncTargetsResponseDTOSchema = z
  .object({
    targets: z.array(BackendSyncJobDTOSchema),
    leased_until: z.string().datetime({ offset: true }).nullable(),
    queue_lag_seconds: z.number().int().min(0).nullable(),
  })
  .strict()

export type BackendSyncTargetsResponseDTO = z.infer<typeof BackendSyncTargetsResponseDTOSchema>

export const AgentSyncJobSchema = z.object({
  syncRequestId: z.string().uuid(),
  provider: AgentProviderSchema,
  refType: z.literal('container'),
  ref: z.string().min(1),
})

export type AgentSyncJob = z.infer<typeof AgentSyncJobSchema>

export const BackendSyncAckDTOSchema = z
  .object({
    sync_request_id: z.string().uuid(),
    provider: AgentProviderSchema,
    ref_type: z.literal('container'),
    ref: z.string().min(1),
    status: z.literal('DONE'),
    snapshot_id: z.string().uuid(),
    new_observations_count: z.number().int().min(0).nullable(),
    new_alerts_count: z.number().int().min(0).nullable(),
    occurred_at: z.string().datetime({ offset: true }),
  })
  .strict()

export type BackendSyncAckDTO = z.infer<typeof BackendSyncAckDTOSchema>

export const BackendSyncFailureDTOSchema = z
  .object({
    sync_request_id: z.string().uuid(),
    provider: AgentProviderSchema,
    ref_type: z.literal('container'),
    ref: z.string().min(1),
    status: z.literal('FAILED'),
    error: z.string().min(1),
    snapshot_id: z.string().uuid().nullable(),
    occurred_at: z.string().datetime({ offset: true }),
  })
  .strict()

export type BackendSyncFailureDTO = z.infer<typeof BackendSyncFailureDTOSchema>

export const IngestAcceptedResponseSchema = z
  .object({
    ok: z.literal(true),
    snapshot_id: z.string().uuid(),
    new_observations_count: z.number().int().min(0).optional(),
    new_alerts_count: z.number().int().min(0).optional(),
  })
  .strict()

export const IngestFailedResponseSchema = z
  .object({
    error: z.string().min(1),
    snapshot_id: z.string().uuid().optional(),
  })
  .strict()
