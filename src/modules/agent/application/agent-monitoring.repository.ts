import type { Json } from '~/shared/supabase/database.types'

export type AgentStatus = 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED' | 'UNKNOWN'

export type AgentRealtimeState =
  | 'SUBSCRIBED'
  | 'CHANNEL_ERROR'
  | 'CONNECTING'
  | 'DISCONNECTED'
  | 'UNKNOWN'

export type AgentProcessingState = 'idle' | 'leasing' | 'processing' | 'backing_off' | 'unknown'

export type AgentLeaseHealth = 'healthy' | 'stale' | 'conflict' | 'unknown'

export type AgentBootStatus = 'starting' | 'healthy' | 'degraded' | 'unknown'

export type AgentUpdaterState =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'draining'
  | 'applying'
  | 'rollback'
  | 'blocked'
  | 'error'
  | 'unknown'

export type AgentEnrollmentMethod = 'bootstrap-token' | 'manual' | 'unknown'

export type AgentActivityType =
  | 'ENROLLED'
  | 'HEARTBEAT'
  | 'LEASED_TARGET'
  | 'SNAPSHOT_INGESTED'
  | 'REQUEST_FAILED'
  | 'REALTIME_SUBSCRIBED'
  | 'REALTIME_CHANNEL_ERROR'
  | 'LEASE_CONFLICT'
  | 'UPDATE_CHECKED'
  | 'UPDATE_AVAILABLE'
  | 'UPDATE_DOWNLOAD_STARTED'
  | 'UPDATE_DOWNLOAD_COMPLETED'
  | 'UPDATE_READY'
  | 'UPDATE_APPLY_STARTED'
  | 'UPDATE_APPLY_FAILED'
  | 'RESTART_FOR_UPDATE'
  | 'ROLLBACK_EXECUTED'

export type AgentActivitySeverity = 'info' | 'warning' | 'danger' | 'success'

export type AgentListSortField =
  | 'status'
  | 'tenant'
  | 'lastSeen'
  | 'failures'
  | 'queueLag'
  | 'activeJobs'

export type AgentListSortDirection = 'asc' | 'desc'

export type AgentMonitoringRecord = {
  readonly agentId: string
  readonly tenantId: string
  readonly hostname: string
  readonly version: string
  readonly currentVersion: string
  readonly desiredVersion: string | null
  readonly updateChannel: string
  readonly updaterState: AgentUpdaterState
  readonly updaterLastCheckedAt: string | null
  readonly updaterLastError: string | null
  readonly updateReadyVersion: string | null
  readonly restartRequestedAt: string | null
  readonly bootStatus: AgentBootStatus
  readonly status: AgentStatus
  readonly enrolledAt: string | null
  readonly lastSeenAt: string | null
  readonly activeJobs: number
  readonly capabilities: readonly string[]
  readonly realtimeState: AgentRealtimeState
  readonly processingState: AgentProcessingState
  readonly leaseHealth: AgentLeaseHealth
  readonly enrollmentMethod: AgentEnrollmentMethod
  readonly tokenIdMasked: string | null
  readonly intervalSec: number | null
  readonly lastError: string | null
  readonly queueLagSeconds: number | null
}

export type AgentAuthenticatedIdentity = {
  readonly agentId: string
  readonly tenantId: string
  readonly hostname: string
  readonly intervalSec: number
  readonly capabilities: readonly string[]
}

export type AgentActivityEventRecord = {
  readonly id: string
  readonly agentId: string
  readonly tenantId: string
  readonly type: AgentActivityType
  readonly message: string
  readonly severity: AgentActivitySeverity
  readonly metadata: Json
  readonly occurredAt: string
}

export type AgentRuntimeStateUpdate = {
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
  readonly status?: AgentStatus
  readonly lastSeenAt?: string
  readonly realtimeState?: AgentRealtimeState
  readonly processingState?: AgentProcessingState
  readonly leaseHealth?: AgentLeaseHealth
  readonly activeJobs?: number
  readonly capabilities?: readonly string[]
  readonly intervalSec?: number
  readonly queueLagSeconds?: number | null
  readonly lastError?: string | null
}

export type AgentActivityInsertRecord = {
  readonly agentId: string
  readonly tenantId: string
  readonly type: AgentActivityType
  readonly message: string
  readonly severity: AgentActivitySeverity
  readonly metadata: Json
  readonly occurredAt: string
}

export type AgentMonitoringRepository = {
  readonly listAgentsForTenant: (command: {
    readonly tenantId: string
    readonly search?: string
    readonly capability?: string
  }) => Promise<readonly AgentMonitoringRecord[]>
  readonly getAgentDetailForTenant: (command: {
    readonly tenantId: string
    readonly agentId: string
  }) => Promise<AgentMonitoringRecord | null>
  readonly listActivityEventsForAgentsSince: (command: {
    readonly tenantId: string
    readonly agentIds: readonly string[]
    readonly sinceIso: string
  }) => Promise<readonly AgentActivityEventRecord[]>
  readonly listRecentActivityForAgent: (command: {
    readonly tenantId: string
    readonly agentId: string
    readonly limit: number
  }) => Promise<readonly AgentActivityEventRecord[]>
  readonly getTenantQueueLagSeconds: (command: {
    readonly tenantId: string
  }) => Promise<number | null>
  readonly authenticateAgentToken: (command: {
    readonly token: string
  }) => Promise<AgentAuthenticatedIdentity | null>
  readonly updateAgentRuntimeState: (
    command: AgentRuntimeStateUpdate,
  ) => Promise<AgentMonitoringRecord | null>
  readonly requestAgentUpdate: (command: {
    readonly tenantId: string
    readonly agentId: string
    readonly desiredVersion: string
    readonly updateChannel: string
    readonly requestedAt: string
  }) => Promise<AgentMonitoringRecord | null>
  readonly requestAgentRestart: (command: {
    readonly tenantId: string
    readonly agentId: string
    readonly requestedAt: string
  }) => Promise<AgentMonitoringRecord | null>
  readonly insertActivityEvents: (events: readonly AgentActivityInsertRecord[]) => Promise<void>
}
