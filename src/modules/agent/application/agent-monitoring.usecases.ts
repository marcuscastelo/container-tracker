import type {
  AgentActivityInsertRecord,
  AgentActivitySeverity,
  AgentActivityType,
  AgentAuthenticatedIdentity,
  AgentBootStatus,
  AgentLeaseHealth,
  AgentListSortDirection,
  AgentListSortField,
  AgentMonitoringRecord,
  AgentMonitoringRepository,
  AgentProcessingState,
  AgentRealtimeState,
  AgentStatus,
  AgentUpdaterState,
} from '~/modules/agent/application/agent-monitoring.repository'
import type { Json } from '~/shared/supabase/database.types'

type AgentMetrics = {
  readonly jobsLastHour: number
  readonly failuresLastHour: number
  readonly avgJobDurationMs: number | null
}

type AgentSummaryReadModel = {
  readonly agentId: string
  readonly tenantId: string
  readonly tenantName: string
  readonly hostname: string
  readonly version: string
  readonly currentVersion: string
  readonly desiredVersion: string | null
  readonly updateChannel: string
  readonly updaterState: AgentUpdaterState
  readonly updateAvailable: boolean
  readonly restartRequired: boolean
  readonly lastUpdateError: string | null
  readonly updateReadyVersion: string | null
  readonly bootStatus: AgentBootStatus
  readonly status: AgentStatus
  readonly enrolledAt: string | null
  readonly lastSeenAt: string | null
  readonly activeJobs: number
  readonly jobsLastHour: number
  readonly failuresLastHour: number
  readonly avgJobDurationMs: number | null
  readonly queueLagSeconds: number | null
  readonly capabilities: string[]
  readonly realtimeState: AgentRealtimeState
}

type AgentActivityReadModel = {
  readonly id: string
  readonly occurredAt: string
  readonly type: AgentActivityType
  readonly message: string
  readonly severity: AgentActivitySeverity
}

type AgentDetailReadModel = AgentSummaryReadModel & {
  readonly enrollmentMethod: 'bootstrap-token' | 'manual' | 'unknown'
  readonly tokenIdMasked: string | null
  readonly intervalSec: number | null
  readonly processingState: AgentProcessingState
  readonly leaseHealth: AgentLeaseHealth
  readonly lastError: string | null
  readonly updaterLastCheckedAt: string | null
  readonly restartRequestedAt: string | null
  readonly recentActivity: AgentActivityReadModel[]
}

type AgentFleetSummaryReadModel = {
  readonly totalAgents: number
  readonly connectedCount: number
  readonly degradedCount: number
  readonly disconnectedCount: number
  readonly totalActiveJobs: number
  readonly totalFailuresLastHour: number
  readonly maxQueueLagSeconds: number | null
  readonly tenantCount: number
}

type ListAgentsCommand = {
  readonly tenantId: string
  readonly search?: string
  readonly status?: AgentStatus
  readonly capability?: string
  readonly onlyProblematic?: boolean
  readonly sortField?: AgentListSortField
  readonly sortDirection?: AgentListSortDirection
  readonly now?: Date
}

type UpdateRuntimeStateCommand = {
  readonly agentId: string
  readonly tenantId: string
  readonly hostname?: string
  readonly version?: string
  readonly currentVersion?: string
  readonly desiredVersion?: string | null
  readonly updateChannel?: string
  readonly updaterState?: AgentUpdaterState
  readonly updaterLastCheckedAt?: string | null
  readonly updaterLastError?: string | null
  readonly updateReadyVersion?: string | null
  readonly restartRequestedAt?: string | null
  readonly bootStatus?: AgentBootStatus
  readonly realtimeState?: AgentRealtimeState
  readonly processingState?: AgentProcessingState
  readonly leaseHealth?: AgentLeaseHealth
  readonly activeJobs?: number
  readonly capabilities?: readonly string[]
  readonly intervalSec?: number
  readonly queueLagSeconds?: number | null
  readonly lastError?: string | null
  readonly lastSeenAt?: string
  readonly status?: AgentStatus
}

type HeartbeatCommand = UpdateRuntimeStateCommand & {
  readonly message?: string
  readonly occurredAt?: string
}

type RecordActivityCommand = {
  readonly agentId: string
  readonly tenantId: string
  readonly type: AgentActivityType
  readonly message: string
  readonly severity: AgentActivitySeverity
  readonly metadata?: unknown
  readonly occurredAt?: string
}

type GetAgentDetailCommand = {
  readonly tenantId: string
  readonly agentId: string
  readonly now?: Date
}

type RequestAgentUpdateCommand = {
  readonly tenantId: string
  readonly agentId: string
  readonly desiredVersion: string
  readonly updateChannel: string
  readonly requestedAt?: string
}

type RequestAgentRestartCommand = {
  readonly tenantId: string
  readonly agentId: string
  readonly requestedAt?: string
}

type AgentUpdateManifestReadModel = {
  readonly version: string
  readonly downloadUrl: string | null
  readonly checksum: string | null
  readonly channel: string
  readonly updateAvailable: boolean
  readonly desiredVersion: string | null
  readonly currentVersion: string
  readonly updateReadyVersion: string | null
  readonly restartRequired: boolean
  readonly restartRequestedAt: string | null
}

const DEFAULT_ACTIVITY_LIMIT = 40

const STATUS_SORT_WEIGHT: Record<AgentStatus, number> = {
  DISCONNECTED: 0,
  DEGRADED: 1,
  UNKNOWN: 2,
  CONNECTED: 3,
}

function parseIsoDate(value: string | null): Date | null {
  if (value === null) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function deriveDisconnectedThresholdMs(intervalSec: number | null): number {
  const baseSec = intervalSec === null ? 60 : Math.max(intervalSec, 15)
  return Math.max(baseSec * 3 * 1000, 90_000)
}

function hasNonBlankText(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false
  return value.trim().length > 0
}

function hasUpdateAvailable(record: AgentMonitoringRecord): boolean {
  if (!record.desiredVersion) return false
  return record.desiredVersion !== record.currentVersion
}

function isRestartRequired(record: AgentMonitoringRecord): boolean {
  if (!record.restartRequestedAt) return false

  const requestedAtMs = parseIsoDate(record.restartRequestedAt)?.getTime() ?? null
  if (requestedAtMs === null) {
    return false
  }

  const lastSeenMs = parseIsoDate(record.lastSeenAt)?.getTime() ?? null
  if (lastSeenMs === null) {
    return true
  }

  return lastSeenMs <= requestedAtMs
}

function deriveRuntimeStatus(command: {
  readonly status?: AgentStatus
  readonly bootStatus?: AgentBootStatus
  readonly updaterState?: AgentUpdaterState
  readonly realtimeState?: AgentRealtimeState
  readonly processingState?: AgentProcessingState
  readonly leaseHealth?: AgentLeaseHealth
  readonly lastError?: string | null
  readonly lastSeenAt?: string
}): AgentStatus | undefined {
  if (command.status) return command.status

  if (command.realtimeState === 'DISCONNECTED') return 'DISCONNECTED'
  if (
    command.bootStatus === 'degraded' ||
    command.updaterState === 'error' ||
    command.realtimeState === 'CHANNEL_ERROR' ||
    command.processingState === 'backing_off' ||
    command.leaseHealth === 'conflict' ||
    command.leaseHealth === 'stale' ||
    hasNonBlankText(command.lastError)
  ) {
    return 'DEGRADED'
  }

  if (typeof command.lastSeenAt === 'string') {
    return 'CONNECTED'
  }

  return undefined
}

function deriveReadStatus(command: {
  readonly record: AgentMonitoringRecord
  readonly now: Date
  readonly failuresLastHour: number
}): AgentStatus {
  // Operational status is server-derived:
  // stale heartbeat => DISCONNECTED, live-but-unhealthy signals => DEGRADED, otherwise CONNECTED.
  const lastSeen = parseIsoDate(command.record.lastSeenAt)
  if (!lastSeen) return 'UNKNOWN'

  const staleThresholdMs = deriveDisconnectedThresholdMs(command.record.intervalSec)
  const elapsedMs = command.now.getTime() - lastSeen.getTime()
  if (elapsedMs > staleThresholdMs) return 'DISCONNECTED'

  if (
    command.record.bootStatus === 'degraded' ||
    command.record.updaterState === 'error' ||
    command.record.updaterState === 'blocked' ||
    command.record.realtimeState === 'CHANNEL_ERROR' ||
    command.record.processingState === 'backing_off' ||
    command.record.leaseHealth === 'conflict' ||
    command.record.leaseHealth === 'stale' ||
    command.failuresLastHour > 0 ||
    hasNonBlankText(command.record.lastError)
  ) {
    return 'DEGRADED'
  }

  return 'CONNECTED'
}

function isJsonRecord(value: Json): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toJsonValue(value: unknown): Json {
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item))
  }

  if (typeof value === 'object') {
    const output: { [key: string]: Json | undefined } = {}
    for (const [key, item] of Object.entries(value)) {
      output[key] = toJsonValue(item)
    }
    return output
  }

  return String(value)
}

function extractDurationMsFromMetadata(metadata: Json): number | null {
  if (!isJsonRecord(metadata)) return null
  const durationCandidate = metadata.durationMs ?? metadata.duration_ms

  if (typeof durationCandidate === 'number' && Number.isFinite(durationCandidate)) {
    const normalized = Math.round(durationCandidate)
    return normalized >= 0 ? normalized : null
  }

  if (typeof durationCandidate === 'string') {
    const parsed = Number.parseInt(durationCandidate, 10)
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed
  }

  return null
}

function computeMetricsByAgent(
  events: readonly {
    readonly agentId: string
    readonly type: AgentActivityType
    readonly metadata: Json
  }[],
): ReadonlyMap<string, AgentMetrics> {
  const accumulators = new Map<
    string,
    {
      jobsLastHour: number
      failuresLastHour: number
      durationTotalMs: number
      durationCount: number
    }
  >()

  for (const event of events) {
    const accumulator = accumulators.get(event.agentId) ?? {
      jobsLastHour: 0,
      failuresLastHour: 0,
      durationTotalMs: 0,
      durationCount: 0,
    }

    if (event.type === 'SNAPSHOT_INGESTED') {
      accumulator.jobsLastHour += 1
      const durationMs = extractDurationMsFromMetadata(event.metadata)
      if (durationMs !== null) {
        accumulator.durationTotalMs += durationMs
        accumulator.durationCount += 1
      }
    }

    if (event.type === 'REQUEST_FAILED' || event.type === 'LEASE_CONFLICT') {
      accumulator.failuresLastHour += 1
    }

    accumulators.set(event.agentId, accumulator)
  }

  const metrics = new Map<string, AgentMetrics>()
  for (const [agentId, value] of accumulators) {
    metrics.set(agentId, {
      jobsLastHour: value.jobsLastHour,
      failuresLastHour: value.failuresLastHour,
      avgJobDurationMs:
        value.durationCount > 0 ? Math.round(value.durationTotalMs / value.durationCount) : null,
    })
  }

  return metrics
}

function toSummaryReadModel(command: {
  readonly record: AgentMonitoringRecord
  readonly metrics: AgentMetrics
  readonly queueLagSeconds: number | null
  readonly now: Date
}): AgentSummaryReadModel {
  const status = deriveReadStatus({
    record: command.record,
    now: command.now,
    failuresLastHour: command.metrics.failuresLastHour,
  })

  return {
    agentId: command.record.agentId,
    tenantId: command.record.tenantId,
    // NOTE: tenantName currently carries the tenantId until a tenant lookup/read-model
    // is available to resolve a human-friendly name. Reviewer suggested resolving
    // the actual tenant name or renaming the field; that change requires cross-boundary
    // lookups and is deferred for a follow-up issue: keep ID here to avoid breaking types.
    tenantName: command.record.tenantId,
    hostname: command.record.hostname,
    version: command.record.version,
    currentVersion: command.record.currentVersion,
    desiredVersion: command.record.desiredVersion,
    updateChannel: command.record.updateChannel,
    updaterState: command.record.updaterState,
    updateAvailable: hasUpdateAvailable(command.record),
    restartRequired: isRestartRequired(command.record),
    lastUpdateError: command.record.updaterLastError,
    updateReadyVersion: command.record.updateReadyVersion,
    bootStatus: command.record.bootStatus,
    status,
    enrolledAt: command.record.enrolledAt,
    lastSeenAt: command.record.lastSeenAt,
    activeJobs: command.record.activeJobs,
    jobsLastHour: command.metrics.jobsLastHour,
    failuresLastHour: command.metrics.failuresLastHour,
    avgJobDurationMs: command.metrics.avgJobDurationMs,
    queueLagSeconds: command.queueLagSeconds ?? command.record.queueLagSeconds,
    capabilities: [...command.record.capabilities],
    realtimeState: command.record.realtimeState,
  }
}

function toFleetSummary(agents: readonly AgentSummaryReadModel[]): AgentFleetSummaryReadModel {
  let connectedCount = 0
  let degradedCount = 0
  let disconnectedCount = 0
  let totalActiveJobs = 0
  let totalFailuresLastHour = 0
  let maxQueueLagSeconds: number | null = null
  const tenants = new Set<string>()

  for (const agent of agents) {
    tenants.add(agent.tenantId)
    totalActiveJobs += agent.activeJobs
    totalFailuresLastHour += agent.failuresLastHour

    if (agent.queueLagSeconds !== null) {
      maxQueueLagSeconds =
        maxQueueLagSeconds === null
          ? agent.queueLagSeconds
          : Math.max(maxQueueLagSeconds, agent.queueLagSeconds)
    }

    if (agent.status === 'CONNECTED') connectedCount += 1
    if (agent.status === 'DEGRADED') degradedCount += 1
    if (agent.status === 'DISCONNECTED') disconnectedCount += 1
  }

  return {
    totalAgents: agents.length,
    connectedCount,
    degradedCount,
    disconnectedCount,
    totalActiveJobs,
    totalFailuresLastHour,
    maxQueueLagSeconds,
    tenantCount: tenants.size,
  }
}

function isProblematicAgent(agent: AgentSummaryReadModel): boolean {
  return (
    agent.status === 'DEGRADED' ||
    agent.status === 'DISCONNECTED' ||
    agent.updateAvailable ||
    agent.restartRequired ||
    agent.failuresLastHour > 0 ||
    (agent.queueLagSeconds !== null && agent.queueLagSeconds > 30)
  )
}

function sortAgents(
  agents: readonly AgentSummaryReadModel[],
  field: AgentListSortField,
  direction: AgentListSortDirection,
): AgentSummaryReadModel[] {
  const directionFactor = direction === 'asc' ? 1 : -1
  const copy = [...agents]

  copy.sort((left, right) => {
    if (field === 'status') {
      return (STATUS_SORT_WEIGHT[left.status] - STATUS_SORT_WEIGHT[right.status]) * directionFactor
    }

    if (field === 'tenant') {
      return left.tenantName.localeCompare(right.tenantName) * directionFactor
    }

    if (field === 'failures') {
      return (left.failuresLastHour - right.failuresLastHour) * directionFactor
    }

    if (field === 'queueLag') {
      const leftLag = left.queueLagSeconds ?? -1
      const rightLag = right.queueLagSeconds ?? -1
      return (leftLag - rightLag) * directionFactor
    }

    if (field === 'activeJobs') {
      return (left.activeJobs - right.activeJobs) * directionFactor
    }

    const leftLastSeenMs = parseIsoDate(left.lastSeenAt)?.getTime() ?? 0
    const rightLastSeenMs = parseIsoDate(right.lastSeenAt)?.getTime() ?? 0
    return (leftLastSeenMs - rightLastSeenMs) * directionFactor
  })

  return copy
}

export function createAgentMonitoringUseCases(deps: {
  readonly repository: AgentMonitoringRepository
  readonly updateManifestConfig?: {
    readonly version?: string
    readonly downloadUrl?: string
    readonly checksum?: string
    readonly channel?: string
  }
}) {
  const listAgents = async (
    command: ListAgentsCommand,
  ): Promise<{
    readonly agents: AgentSummaryReadModel[]
    readonly summary: AgentFleetSummaryReadModel
  }> => {
    const now = command.now ?? new Date()
    const sinceIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

    const records = await deps.repository.listAgentsForTenant({
      tenantId: command.tenantId,
      search: command.search,
      capability: command.capability,
    })

    const queueLagSeconds = await deps.repository.getTenantQueueLagSeconds({
      tenantId: command.tenantId,
    })

    const agentIds = records.map((record) => record.agentId)
    const events =
      agentIds.length > 0
        ? await deps.repository.listActivityEventsForAgentsSince({
            tenantId: command.tenantId,
            agentIds,
            sinceIso,
          })
        : []

    const metricsByAgent = computeMetricsByAgent(events)

    let agents = records.map((record) =>
      toSummaryReadModel({
        record,
        metrics: metricsByAgent.get(record.agentId) ?? {
          jobsLastHour: 0,
          failuresLastHour: 0,
          avgJobDurationMs: null,
        },
        queueLagSeconds,
        now,
      }),
    )

    if (command.status) {
      agents = agents.filter((agent) => agent.status === command.status)
    }

    if (command.onlyProblematic === true) {
      agents = agents.filter((agent) => isProblematicAgent(agent))
    }

    const sortedAgents = sortAgents(
      agents,
      command.sortField ?? 'status',
      command.sortDirection ?? 'asc',
    )

    return {
      agents: sortedAgents,
      summary: toFleetSummary(sortedAgents),
    }
  }

  const getAgentDetail = async (
    command: GetAgentDetailCommand,
  ): Promise<AgentDetailReadModel | null> => {
    const now = command.now ?? new Date()
    const sinceIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const record = await deps.repository.getAgentDetailForTenant({
      tenantId: command.tenantId,
      agentId: command.agentId,
    })

    if (!record) return null

    const queueLagSeconds = await deps.repository.getTenantQueueLagSeconds({
      tenantId: command.tenantId,
    })

    const lastHourEvents = await deps.repository.listActivityEventsForAgentsSince({
      tenantId: command.tenantId,
      agentIds: [record.agentId],
      sinceIso,
    })
    const metrics = computeMetricsByAgent(lastHourEvents).get(record.agentId) ?? {
      jobsLastHour: 0,
      failuresLastHour: 0,
      avgJobDurationMs: null,
    }

    const recentEvents = await deps.repository.listRecentActivityForAgent({
      tenantId: command.tenantId,
      agentId: record.agentId,
      limit: DEFAULT_ACTIVITY_LIMIT,
    })

    const summary = toSummaryReadModel({
      record,
      metrics,
      queueLagSeconds,
      now,
    })

    return {
      ...summary,
      enrollmentMethod: record.enrollmentMethod,
      tokenIdMasked: record.tokenIdMasked,
      intervalSec: record.intervalSec,
      processingState: record.processingState,
      leaseHealth: record.leaseHealth,
      lastError: record.lastError,
      updaterLastCheckedAt: record.updaterLastCheckedAt,
      restartRequestedAt: record.restartRequestedAt,
      recentActivity: recentEvents.map((event) => ({
        id: event.id,
        occurredAt: event.occurredAt,
        type: event.type,
        message: event.message,
        severity: event.severity,
      })),
    }
  }

  const updateRuntimeState = async (command: UpdateRuntimeStateCommand): Promise<void> => {
    const derivedStatus = deriveRuntimeStatus({
      status: command.status,
      bootStatus: command.bootStatus,
      updaterState: command.updaterState,
      realtimeState: command.realtimeState,
      processingState: command.processingState,
      leaseHealth: command.leaseHealth,
      lastError: command.lastError,
      lastSeenAt: command.lastSeenAt,
    })

    await deps.repository.updateAgentRuntimeState({
      ...command,
      status: derivedStatus,
    })
  }

  const touchHeartbeat = async (command: HeartbeatCommand): Promise<void> => {
    const occurredAt = command.occurredAt ?? new Date().toISOString()

    await updateRuntimeState({
      ...command,
      lastSeenAt: command.lastSeenAt ?? occurredAt,
    })

    await deps.repository.insertActivityEvents([
      {
        agentId: command.agentId,
        tenantId: command.tenantId,
        type: 'HEARTBEAT',
        message: command.message ?? 'Heartbeat received from agent runtime',
        severity: 'info',
        metadata: {},
        occurredAt,
      },
    ])
  }

  const recordActivity = async (
    command: RecordActivityCommand | readonly RecordActivityCommand[],
  ): Promise<void> => {
    const events = Array.isArray(command) ? command : [command]
    const nowIso = new Date().toISOString()
    const normalized: AgentActivityInsertRecord[] = events.map((event) => ({
      agentId: event.agentId,
      tenantId: event.tenantId,
      type: event.type,
      message: event.message,
      severity: event.severity,
      metadata: toJsonValue(event.metadata ?? {}),
      occurredAt: event.occurredAt ?? nowIso,
    }))

    await deps.repository.insertActivityEvents(normalized)
  }

  const authenticateAgentToken = async (command: {
    readonly token: string
  }): Promise<AgentAuthenticatedIdentity | null> => {
    return deps.repository.authenticateAgentToken(command)
  }

  const requestAgentUpdate = async (
    command: RequestAgentUpdateCommand,
  ): Promise<AgentMonitoringRecord | null> => {
    const requestedAt = command.requestedAt ?? new Date().toISOString()
    return deps.repository.requestAgentUpdate({
      tenantId: command.tenantId,
      agentId: command.agentId,
      desiredVersion: command.desiredVersion,
      updateChannel: command.updateChannel,
      requestedAt,
    })
  }

  const requestAgentRestart = async (
    command: RequestAgentRestartCommand,
  ): Promise<AgentMonitoringRecord | null> => {
    const requestedAt = command.requestedAt ?? new Date().toISOString()
    return deps.repository.requestAgentRestart({
      tenantId: command.tenantId,
      agentId: command.agentId,
      requestedAt,
    })
  }

  const getUpdateManifestForAgent = async (command: {
    readonly tenantId: string
    readonly agentId: string
  }): Promise<AgentUpdateManifestReadModel | null> => {
    const record = await deps.repository.getAgentDetailForTenant({
      tenantId: command.tenantId,
      agentId: command.agentId,
    })

    if (!record) {
      return null
    }

    const configuredVersion = deps.updateManifestConfig?.version
    const configuredChannel = deps.updateManifestConfig?.channel
    const restartRequired = isRestartRequired(record)

    const desiredVersion = record.desiredVersion
    const version = configuredVersion ?? desiredVersion ?? record.currentVersion
    const channel = configuredChannel ?? record.updateChannel
    const canServeConfiguredManifest =
      configuredVersion === undefined || desiredVersion === configuredVersion
    const hasConfiguredManifest =
      configuredVersion !== undefined &&
      deps.updateManifestConfig?.downloadUrl !== undefined &&
      deps.updateManifestConfig?.checksum !== undefined
    const updateAvailable =
      hasUpdateAvailable(record) && canServeConfiguredManifest && hasConfiguredManifest

    return {
      version,
      downloadUrl: canServeConfiguredManifest
        ? (deps.updateManifestConfig?.downloadUrl ?? null)
        : null,
      checksum: canServeConfiguredManifest ? (deps.updateManifestConfig?.checksum ?? null) : null,
      channel,
      updateAvailable,
      desiredVersion,
      currentVersion: record.currentVersion,
      updateReadyVersion: record.updateReadyVersion,
      restartRequired,
      restartRequestedAt: record.restartRequestedAt,
    }
  }

  return {
    listAgents,
    getAgentDetail,
    updateRuntimeState,
    touchHeartbeat,
    recordActivity,
    authenticateAgentToken,
    requestAgentUpdate,
    requestAgentRestart,
    getUpdateManifestForAgent,
  }
}

export type AgentMonitoringUseCases = ReturnType<typeof createAgentMonitoringUseCases>
