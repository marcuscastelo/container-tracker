import type {
  AgentActivityInsertRecord,
  AgentActivitySeverity,
  AgentActivityType,
  AgentAuthenticatedIdentity,
  AgentBootStatus,
  AgentInfraConfigRecord,
  AgentLeaseHealth,
  AgentListSortDirection,
  AgentListSortField,
  AgentLogChannel,
  AgentMonitoringRecord,
  AgentMonitoringRepository,
  AgentProcessingState,
  AgentRealtimeState,
  AgentRemoteCommandRecord,
  AgentRemotePolicyRecord,
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
  readonly os: string
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
  readonly logsSupported: boolean
  readonly lastLogAt: string | null
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

type AgentLogReadModel = {
  readonly id: string
  readonly agentId: string
  readonly channel: AgentLogChannel
  readonly timestamp: string
  readonly message: string
  readonly sequence: number
  readonly truncated: boolean
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
  readonly logsSupported?: boolean
  readonly lastLogAt?: string | null
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

type GetAgentLogsCommand = {
  readonly tenantId: string
  readonly agentId: string
  readonly channel: AgentLogChannel | 'both'
  readonly tail: number
}

type IngestAgentLogsCommand = {
  readonly tenantId: string
  readonly agentId: string
  readonly lines: readonly {
    readonly sequence: number
    readonly channel: AgentLogChannel
    readonly message: string
    readonly occurredAt?: string
    readonly truncated?: boolean
  }[]
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

type GetRemoteControlStateCommand = {
  readonly tenantId: string
  readonly agentId: string
}

type AcknowledgeRemoteControlCommand = {
  readonly tenantId: string
  readonly agentId: string
  readonly commandId: string
  readonly acknowledgedAt?: string
  readonly status?: 'APPLIED' | 'IGNORED' | 'FAILED'
  readonly detail?: string | null
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

type AgentRemoteControlStateReadModel = {
  readonly policy: AgentRemotePolicyRecord
  readonly commands: readonly AgentRemoteCommandRecord[]
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
    os: command.record.os,
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
    logsSupported: command.record.logsSupported,
    lastLogAt: command.record.lastLogAt,
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
      ...(command.search === undefined ? {} : { search: command.search }),
      ...(command.capability === undefined ? {} : { capability: command.capability }),
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

  const getAgentLogs = async (
    command: GetAgentLogsCommand,
  ): Promise<{
    readonly agentId: string
    readonly os: string
    readonly logsSupported: boolean
    readonly lastLogAt: string | null
    readonly lines: readonly AgentLogReadModel[]
  } | null> => {
    const record = await deps.repository.getAgentDetailForTenant({
      tenantId: command.tenantId,
      agentId: command.agentId,
    })
    if (!record) return null

    const lines = await deps.repository.listRecentLogsForAgent({
      tenantId: command.tenantId,
      agentId: command.agentId,
      channel: command.channel,
      tail: command.tail,
    })

    return {
      agentId: record.agentId,
      os: record.os,
      logsSupported: record.logsSupported,
      lastLogAt: record.lastLogAt,
      lines: lines.map((line) => ({
        id: line.id,
        agentId: line.agentId,
        channel: line.channel,
        timestamp: line.occurredAt,
        message: line.message,
        sequence: line.sequence,
        truncated: line.truncated,
      })),
    }
  }

  const updateRuntimeState = async (command: UpdateRuntimeStateCommand): Promise<void> => {
    const derivedStatus = deriveRuntimeStatus({
      ...(command.status === undefined ? {} : { status: command.status }),
      ...(command.bootStatus === undefined ? {} : { bootStatus: command.bootStatus }),
      ...(command.updaterState === undefined ? {} : { updaterState: command.updaterState }),
      ...(command.realtimeState === undefined ? {} : { realtimeState: command.realtimeState }),
      ...(command.processingState === undefined
        ? {}
        : { processingState: command.processingState }),
      ...(command.leaseHealth === undefined ? {} : { leaseHealth: command.leaseHealth }),
      ...(command.lastError === undefined ? {} : { lastError: command.lastError }),
      ...(command.lastSeenAt === undefined ? {} : { lastSeenAt: command.lastSeenAt }),
    })

    await deps.repository.updateAgentRuntimeState({
      agentId: command.agentId,
      tenantId: command.tenantId,
      ...(command.hostname === undefined ? {} : { hostname: command.hostname }),
      ...(command.version === undefined ? {} : { version: command.version }),
      ...(command.currentVersion === undefined ? {} : { currentVersion: command.currentVersion }),
      ...(command.desiredVersion === undefined ? {} : { desiredVersion: command.desiredVersion }),
      ...(command.updateChannel === undefined ? {} : { updateChannel: command.updateChannel }),
      ...(command.updaterState === undefined ? {} : { updaterState: command.updaterState }),
      ...(command.updaterLastCheckedAt === undefined
        ? {}
        : { updaterLastCheckedAt: command.updaterLastCheckedAt }),
      ...(command.updaterLastError === undefined
        ? {}
        : { updaterLastError: command.updaterLastError }),
      ...(command.updateReadyVersion === undefined
        ? {}
        : { updateReadyVersion: command.updateReadyVersion }),
      ...(command.restartRequestedAt === undefined
        ? {}
        : { restartRequestedAt: command.restartRequestedAt }),
      ...(command.bootStatus === undefined ? {} : { bootStatus: command.bootStatus }),
      ...(command.lastSeenAt === undefined ? {} : { lastSeenAt: command.lastSeenAt }),
      ...(command.realtimeState === undefined ? {} : { realtimeState: command.realtimeState }),
      ...(command.processingState === undefined
        ? {}
        : { processingState: command.processingState }),
      ...(command.leaseHealth === undefined ? {} : { leaseHealth: command.leaseHealth }),
      ...(command.activeJobs === undefined ? {} : { activeJobs: command.activeJobs }),
      ...(command.capabilities === undefined ? {} : { capabilities: command.capabilities }),
      ...(command.intervalSec === undefined ? {} : { intervalSec: command.intervalSec }),
      ...(command.queueLagSeconds === undefined
        ? {}
        : { queueLagSeconds: command.queueLagSeconds }),
      ...(command.lastError === undefined ? {} : { lastError: command.lastError }),
      ...(command.logsSupported === undefined ? {} : { logsSupported: command.logsSupported }),
      ...(command.lastLogAt === undefined ? {} : { lastLogAt: command.lastLogAt }),
      ...(derivedStatus === undefined ? {} : { status: derivedStatus }),
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

  const ingestAgentLogs = async (
    command: IngestAgentLogsCommand,
  ): Promise<{
    readonly accepted: number
    readonly persisted: number
  }> => {
    if (command.lines.length === 0) {
      return {
        accepted: 0,
        persisted: 0,
      }
    }

    const normalized = command.lines.map((line) => ({
      agentId: command.agentId,
      tenantId: command.tenantId,
      channel: line.channel,
      message: line.message,
      sequence: line.sequence,
      truncated: line.truncated ?? false,
      occurredAt: line.occurredAt ?? new Date().toISOString(),
    }))

    return deps.repository.insertLogEvents(normalized)
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

  const getRemoteControlState = async (
    command: GetRemoteControlStateCommand,
  ): Promise<AgentRemoteControlStateReadModel | null> => {
    return deps.repository.getRemoteControlState(command)
  }

  const getInfraConfig = async (command: {
    readonly tenantId: string
    readonly agentId: string
  }): Promise<AgentInfraConfigRecord | null> => {
    return deps.repository.getInfraConfig(command)
  }

  const acknowledgeRemoteControlCommand = async (
    command: AcknowledgeRemoteControlCommand,
  ): Promise<boolean> => {
    return deps.repository.acknowledgeRemoteControlCommand({
      tenantId: command.tenantId,
      agentId: command.agentId,
      commandId: command.commandId,
      acknowledgedAt: command.acknowledgedAt ?? new Date().toISOString(),
      status: command.status ?? 'APPLIED',
      detail: command.detail ?? null,
    })
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
    getAgentLogs,
    updateRuntimeState,
    touchHeartbeat,
    ingestAgentLogs,
    recordActivity,
    authenticateAgentToken,
    getRemoteControlState,
    getInfraConfig,
    acknowledgeRemoteControlCommand,
    requestAgentUpdate,
    requestAgentRestart,
    getUpdateManifestForAgent,
  }
}

export type AgentMonitoringUseCases = ReturnType<typeof createAgentMonitoringUseCases>
