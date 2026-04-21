import z from 'zod/v4'

export const ReplayModeSchema = z.enum(['DRY_RUN', 'APPLY', 'ROLLBACK'])
export const ReplayRunStatusSchema = z.enum([
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'APPLIED',
  'ROLLED_BACK',
])

export const ReplayLookupRequestSchema = z.object({
  containerNumber: z.string().min(1),
})

const ReplayDiffTemporalConflictSchema = z.object({
  fingerprintKey: z.string(),
  rawEventTime: z.string().nullable(),
  beforeInstant: z.string().nullable(),
  afterInstant: z.string().nullable(),
})

export const ReplayDiffSummarySchema = z.object({
  snapshotCount: z.number().int().min(0),
  currentGenerationId: z.string().uuid().nullable(),
  candidateGenerationId: z.string().uuid().nullable(),
  observationsCurrentCount: z.number().int().min(0),
  observationsCandidateCount: z.number().int().min(0),
  alertsCurrentCount: z.number().int().min(0),
  alertsCandidateCount: z.number().int().min(0),
  addedObservationFingerprints: z.array(z.string()),
  removedObservationFingerprints: z.array(z.string()),
  statusChanged: z.boolean(),
  statusBefore: z.string().nullable(),
  statusAfter: z.string().nullable(),
  alertsChanged: z.boolean(),
  potentialTemporalConflicts: z.array(ReplayDiffTemporalConflictSchema),
})

const LastReplayRunSchema = z.object({
  runId: z.string().uuid(),
  mode: ReplayModeSchema,
  status: ReplayRunStatusSchema,
  createdAt: z.string(),
})

export const ReplayLookupResponseSchema = z.object({
  containerId: z.string().uuid(),
  containerNumber: z.string(),
  provider: z.string().nullable(),
  processId: z.string().uuid().nullable(),
  processReference: z.string().nullable(),
  snapshotCount: z.number().int().min(0),
  activeGenerationId: z.string().uuid().nullable(),
  previousGenerationId: z.string().uuid().nullable(),
  lastReplayRun: LastReplayRunSchema.nullable(),
})

export const ReplayRunActionRequestSchema = z.object({
  containerId: z.string().uuid(),
  reason: z.string().trim().min(1).nullable().optional(),
})

const ReplayRunTargetSchema = z.object({
  targetId: z.string().uuid(),
  containerId: z.string().uuid(),
  containerNumber: z.string(),
  provider: z.string().nullable(),
  snapshotCount: z.number().int().min(0),
  status: ReplayRunStatusSchema,
  errorMessage: z.string().nullable(),
  diffSummary: ReplayDiffSummarySchema,
  createdGenerationId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const ReplayRunResponseSchema = z.object({
  runId: z.string().uuid(),
  mode: ReplayModeSchema,
  status: ReplayRunStatusSchema,
  requestedBy: z.string(),
  reason: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  codeVersion: z.string().nullable(),
  errorMessage: z.string().nullable(),
  summary: z.record(z.string(), z.unknown()),
  target: ReplayRunTargetSchema.nullable(),
})

export const ReplayRollbackResponseSchema = z.object({
  runId: z.string().uuid(),
  status: ReplayRunStatusSchema,
  activeGenerationId: z.string().uuid(),
  previousGenerationId: z.string().uuid().nullable(),
})

export const ReplayEnabledResponseSchema = z.object({
  enabled: z.literal(true),
})

export type ReplayLookupRequest = z.infer<typeof ReplayLookupRequestSchema>
export type ReplayLookupResponse = z.infer<typeof ReplayLookupResponseSchema>
export type ReplayRunActionRequest = z.infer<typeof ReplayRunActionRequestSchema>
export type ReplayRunResponse = z.infer<typeof ReplayRunResponseSchema>
export type ReplayRollbackResponse = z.infer<typeof ReplayRollbackResponseSchema>
export type ReplayEnabledResponse = z.infer<typeof ReplayEnabledResponseSchema>
