// ---------------------------------------------------------------------------
// Agent mock DTO types – shaped to match future backend contracts.
// Keep serializable and explicit; no classes, no methods.
// ---------------------------------------------------------------------------

export type AgentStatus = 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED' | 'UNKNOWN'

export type AgentRealtimeState = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'CONNECTING'

export type AgentProcessingState = 'idle' | 'leasing' | 'processing' | 'backing_off'

export type AgentLeaseHealth = 'healthy' | 'stale' | 'conflict' | 'unknown'

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

export type AgentActivitySeverity = 'info' | 'warning' | 'danger' | 'success'

export type AgentActivityEntry = {
  readonly id: string
  readonly occurredAt: string
  readonly type: AgentActivityType
  readonly message: string
  readonly severity: AgentActivitySeverity
}

export type AgentSummaryPayload = {
  readonly agentId: string
  readonly tenantId: string
  readonly tenantName: string
  readonly hostname: string
  readonly version: string
  readonly status: AgentStatus
  readonly enrolledAt: string
  readonly lastSeenAt: string
  readonly activeJobs: number
  readonly jobsLastHour: number
  readonly failuresLastHour: number
  readonly avgJobDurationMs: number | null
  readonly queueLagSeconds: number | null
  readonly capabilities: readonly string[]
  readonly realtimeState: AgentRealtimeState
}

export type AgentDetailPayload = AgentSummaryPayload & {
  readonly enrollmentMethod: AgentEnrollmentMethod
  readonly tokenIdMasked: string | null
  readonly intervalSec: number | null
  readonly processingState: AgentProcessingState
  readonly leaseHealth: AgentLeaseHealth
  readonly lastError: string | null
  readonly recentActivity: readonly AgentActivityEntry[]
}

export type AgentFleetSummary = {
  readonly totalAgents: number
  readonly connectedCount: number
  readonly degradedCount: number
  readonly disconnectedCount: number
  readonly totalActiveJobs: number
  readonly totalFailuresLastHour: number
  readonly maxQueueLagSeconds: number | null
  readonly tenantCount: number
}
