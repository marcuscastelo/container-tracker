import { z } from 'zod/v4'

export const ResolvedSourceSchema = z.enum(['BASE', 'LOCAL', 'REMOTE_POLICY', 'REMOTE_COMMAND'])

export type ResolvedSource = z.infer<typeof ResolvedSourceSchema>

function createResolvedValueSchema<T extends z.ZodType>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    source: ResolvedSourceSchema,
    overridden: z
      .array(
        z.object({
          source: ResolvedSourceSchema,
          value: valueSchema,
        }),
      )
      .default([]),
  })
}

export const ResolvedBooleanValueSchema = createResolvedValueSchema(z.boolean())
export const ResolvedStringValueSchema = createResolvedValueSchema(z.string().min(1))

export type ResolvedValue<T> = {
  readonly value: T
  readonly source: ResolvedSource
  readonly overridden: readonly {
    readonly source: ResolvedSource
    readonly value: T
  }[]
}

export const LocalOverrideStateSchema = z.object({
  updatesPaused: z.boolean().nullable().default(null),
  channel: z.string().trim().min(1).nullable().default(null),
  blockedVersions: z.array(z.string().trim().min(1)).default([]),
  editableConfig: z.record(z.string(), z.string()).default({}),
})

export type LocalOverrideState = z.infer<typeof LocalOverrideStateSchema>

export const RemotePolicyStateSchema = z.object({
  desiredVersion: z.string().trim().min(1).nullable().default(null),
  updateChannel: z.string().trim().min(1).nullable().default(null),
  updatesPaused: z.boolean().default(false),
  blockedVersions: z.array(z.string().trim().min(1)).default([]),
  restartRequestedAt: z.string().datetime({ offset: true }).nullable().default(null),
})

export type RemotePolicyState = z.infer<typeof RemotePolicyStateSchema>

export const RemoteCommandTypeSchema = z.enum(['RESET_AGENT', 'RESTART_AGENT'])
export type RemoteCommandType = z.infer<typeof RemoteCommandTypeSchema>

export const RemoteCommandRecordSchema = z.object({
  id: z.string().uuid(),
  type: RemoteCommandTypeSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  requestedAt: z.string().datetime({ offset: true }),
})

export type RemoteCommandRecord = z.infer<typeof RemoteCommandRecordSchema>

export const AgentInfraConfigSchema = z.object({
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(1),
})

export type AgentInfraConfig = z.infer<typeof AgentInfraConfigSchema>

export const AgentInfraSourceSchema = z.enum(['REMOTE', 'FALLBACK'])
export type AgentInfraSource = z.infer<typeof AgentInfraSourceSchema>

export const AgentRuntimeStatusSchema = z.enum(['RUNNING', 'STOPPED', 'DEGRADED', 'CRASHED'])
export const AgentHealthStatusSchema = z.enum(['HEALTHY', 'DEGRADED', 'UNHEALTHY'])

export const AgentOperationalSnapshotSchema = z.object({
  runtime: z.object({
    status: AgentRuntimeStatusSchema,
    health: AgentHealthStatusSchema,
    lastHeartbeatAt: z.string().datetime({ offset: true }).nullable(),
    activeJobs: z.number().int().min(0),
  }),
  release: z.object({
    current: z.string().min(1).nullable(),
    previous: z.string().min(1).nullable(),
    target: z.string().min(1).nullable(),
  }),
  updates: z.object({
    paused: ResolvedBooleanValueSchema,
    channel: ResolvedStringValueSchema,
    blockedVersions: z.object({
      local: z.array(z.string().min(1)),
      remote: z.array(z.string().min(1)),
      effective: z.array(z.string().min(1)),
    }),
    forceTargetVersion: z.string().min(1).nullable(),
  }),
  config: z.object({
    editable: z.record(z.string(), z.string()),
    requiresRestart: z.array(z.string().min(1)),
  }),
  infra: z.object({
    supabaseUrl: z.string().url(),
    source: AgentInfraSourceSchema,
  }),
})

export type AgentOperationalSnapshot = z.infer<typeof AgentOperationalSnapshotSchema>

export const AgentControlStateResponseSchema = z.object({
  policy: RemotePolicyStateSchema,
  commands: z.array(RemoteCommandRecordSchema),
})

export type AgentControlStateResponse = z.infer<typeof AgentControlStateResponseSchema>

export const AgentInfraConfigResponseSchema = AgentInfraConfigSchema
export type AgentInfraConfigResponse = z.infer<typeof AgentInfraConfigResponseSchema>

export const AgentControlCommandAckResponseSchema = z.object({
  ok: z.literal(true),
  commandId: z.string().uuid(),
  acknowledgedAt: z.string().datetime({ offset: true }),
})

export type AgentControlCommandAckResponse = z.infer<typeof AgentControlCommandAckResponseSchema>

export const AgentControlCommandAckBodySchema = z.object({
  status: z.enum(['APPLIED', 'IGNORED', 'FAILED']).default('APPLIED'),
  detail: z.string().trim().min(1).nullable().default(null),
})

export type AgentControlCommandAckBody = z.infer<typeof AgentControlCommandAckBodySchema>

export const AgentControlRemoteCacheSchema = z.object({
  fetchedAt: z.string().datetime({ offset: true }),
  state: AgentControlStateResponseSchema,
})

export type AgentControlRemoteCache = z.infer<typeof AgentControlRemoteCacheSchema>

export const AgentInfraConfigCacheSchema = z.object({
  fetchedAt: z.string().datetime({ offset: true }),
  config: AgentInfraConfigSchema,
})

export type AgentInfraConfigCache = z.infer<typeof AgentInfraConfigCacheSchema>

export const AgentControlLogChannelSchema = z.enum([
  'stdout',
  'stderr',
  'supervisor',
  'updater',
  'all',
])

export type AgentControlLogChannel = z.infer<typeof AgentControlLogChannelSchema>

export const AgentControlLogLineSchema = z.object({
  channel: z.enum(['stdout', 'stderr', 'supervisor', 'updater']),
  message: z.string(),
  filePath: z.string().min(1),
  lineNumber: z.number().int().min(1),
})

export type AgentControlLogLine = z.infer<typeof AgentControlLogLineSchema>

export const AgentControlLogsResponseSchema = z.object({
  lines: z.array(AgentControlLogLineSchema),
})

export type AgentControlLogsResponse = z.infer<typeof AgentControlLogsResponseSchema>

export const AgentInstalledReleaseSchema = z.object({
  version: z.string().min(1),
  isCurrent: z.boolean(),
  isPrevious: z.boolean(),
  isTarget: z.boolean(),
  entrypointPath: z.string().min(1).nullable(),
})

export type AgentInstalledRelease = z.infer<typeof AgentInstalledReleaseSchema>

export const AgentReleaseInventorySchema = z.object({
  releases: z.array(AgentInstalledReleaseSchema),
})

export type AgentReleaseInventory = z.infer<typeof AgentReleaseInventorySchema>

export const AgentControlPathsSchema = z.object({
  dataDir: z.string().min(1),
  configEnvPath: z.string().min(1),
  releasesDir: z.string().min(1),
  logsDir: z.string().min(1),
  releaseStatePath: z.string().min(1),
  runtimeStatePath: z.string().min(1),
  supervisorControlPath: z.string().min(1),
  controlOverridesPath: z.string().min(1),
  controlRemoteCachePath: z.string().min(1),
  infraConfigPath: z.string().min(1),
  auditLogPath: z.string().min(1),
})

export type AgentControlPaths = z.infer<typeof AgentControlPathsSchema>

export const AgentControlBackendSourceSchema = z.enum([
  'RUNTIME_CONFIG',
  'BASE_RUNTIME_CONFIG',
  'BOOTSTRAP',
  'CONSUMED_BOOTSTRAP',
  'NONE',
])

export type AgentControlBackendSource = z.infer<typeof AgentControlBackendSourceSchema>

export const AgentControlBackendStatusSchema = z.enum([
  'ENROLLED',
  'BOOTSTRAP_ONLY',
  'UNCONFIGURED',
])

export type AgentControlBackendStatus = z.infer<typeof AgentControlBackendStatusSchema>

export const AgentControlBackendStateSchema = z.object({
  backendUrl: z.string().url().nullable(),
  source: AgentControlBackendSourceSchema,
  status: AgentControlBackendStatusSchema,
  runtimeConfigAvailable: z.boolean(),
  bootstrapConfigAvailable: z.boolean(),
  installerTokenAvailable: z.boolean(),
  publicStateAvailable: z.boolean(),
  warnings: z.array(z.string().min(1)).default([]),
})

export type AgentControlBackendState = z.infer<typeof AgentControlBackendStateSchema>

export const AgentControlPublicStateSchema = z.object({
  snapshot: AgentOperationalSnapshotSchema,
  releaseInventory: AgentReleaseInventorySchema,
  paths: AgentControlPathsSchema,
  backendState: AgentControlBackendStateSchema.optional(),
})

export type AgentControlPublicState = z.infer<typeof AgentControlPublicStateSchema>

export const AgentControlCommandResultSchema = z.object({
  ok: z.literal(true),
  message: z.string().min(1),
  snapshot: AgentOperationalSnapshotSchema,
})

export type AgentControlCommandResult = z.infer<typeof AgentControlCommandResultSchema>

export const AgentControlBackendUpdateResultSchema = z.object({
  ok: z.literal(true),
  message: z.string().min(1),
  state: AgentControlBackendStateSchema,
})

export type AgentControlBackendUpdateResult = z.infer<typeof AgentControlBackendUpdateResultSchema>

export const AgentControlAuditEventTypeSchema = z.enum([
  'LOCAL_UPDATE_PAUSED',
  'LOCAL_UPDATE_RESUMED',
  'CHANNEL_CHANGED',
  'CONFIG_UPDATED',
  'RELEASE_ACTIVATED',
  'ROLLBACK_EXECUTED',
  'LOCAL_RESET',
  'REMOTE_RESET',
  'REMOTE_FORCE_UPDATE',
])

export type AgentControlAuditEventType = z.infer<typeof AgentControlAuditEventTypeSchema>

export const AgentControlAuditEventSchema = z.object({
  type: AgentControlAuditEventTypeSchema,
  occurredAt: z.string().datetime({ offset: true }),
  source: z.enum(['LOCAL', 'REMOTE_POLICY', 'REMOTE_COMMAND']),
  message: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export type AgentControlAuditEvent = z.infer<typeof AgentControlAuditEventSchema>
