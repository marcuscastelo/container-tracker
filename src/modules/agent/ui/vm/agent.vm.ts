// ---------------------------------------------------------------------------
// Agent UI ViewModels — display-ready shapes consumed by components.
// ---------------------------------------------------------------------------

import type { AgentActivitySeverity, AgentActivityType } from '~/modules/agent/ui/api/agent.api'

// --- Status visual tone ---

export type AgentStatusTone = 'success' | 'warning' | 'danger' | 'neutral'

// --- List item VM ---

export type AgentListItemVM = {
  readonly agentId: string
  readonly tenantName: string
  readonly hostname: string
  readonly version: string
  readonly currentVersion: string
  readonly desiredVersionDisplay: string
  readonly updateAvailable: boolean
  readonly updaterStateLabel: string
  readonly restartRequired: boolean
  readonly lastUpdateError: string | null
  readonly status: string
  readonly statusTone: AgentStatusTone
  readonly enrolledAtDisplay: string
  readonly lastSeenDisplay: string
  readonly lastSeenRelative: string
  readonly freshness: 'fresh' | 'recent' | 'stale' | 'offline'
  readonly activeJobs: number
  readonly jobsLastHour: number
  readonly failuresLastHour: number
  readonly queueLagDisplay: string
  readonly capabilitiesDisplay: string
  readonly realtimeLabel: string
  readonly realtimeTone: AgentStatusTone
  readonly isProblematic: boolean
}

// --- Fleet summary VM ---

export type AgentFleetSummaryVM = {
  readonly totalAgents: number
  readonly connected: number
  readonly degraded: number
  readonly disconnected: number
  readonly totalActiveJobs: number
  readonly failuresLastHour: number
  readonly maxQueueLagDisplay: string
  readonly tenantCount: number
}

// --- Detail VM ---

export type AgentDetailVM = {
  // Identity
  readonly agentId: string
  readonly tenantName: string
  readonly hostname: string
  readonly version: string
  readonly currentVersion: string
  readonly desiredVersion: string | null
  readonly updateChannel: string
  readonly updaterStateLabel: string
  readonly updateAvailable: boolean
  readonly restartRequired: boolean
  readonly lastUpdateError: string | null
  readonly updateReadyVersion: string | null
  readonly bootStatusLabel: string
  readonly tenantId: string

  // Status & Health
  readonly status: string
  readonly statusTone: AgentStatusTone
  readonly lastSeenDisplay: string
  readonly lastSeenRelative: string
  readonly freshness: 'fresh' | 'recent' | 'stale' | 'offline'
  readonly realtimeLabel: string
  readonly realtimeTone: AgentStatusTone
  readonly leaseHealthLabel: string
  readonly leaseHealthTone: AgentStatusTone
  readonly processingStateLabel: string

  // Metrics
  readonly activeJobs: number
  readonly jobsLastHour: number
  readonly failuresLastHour: number
  readonly avgJobDurationDisplay: string
  readonly queueLagDisplay: string

  // Enrollment / Config
  readonly enrolledAtDisplay: string
  readonly enrollmentMethodLabel: string
  readonly tokenIdMasked: string
  readonly intervalDisplay: string
  readonly updaterLastCheckedDisplay: string
  readonly capabilities: readonly string[]

  // Diagnostics
  readonly lastError: string | null
  readonly diagnosticFlags: readonly DiagnosticFlag[]

  // Activity
  readonly recentActivity: readonly AgentActivityVM[]
}

export type DiagnosticFlag = {
  readonly label: string
  readonly tone: AgentStatusTone
}

export type AgentActivityVM = {
  readonly id: string
  readonly occurredAtDisplay: string
  readonly occurredAtRelative: string
  readonly type: AgentActivityType
  readonly typeLabel: string
  readonly message: string
  readonly severity: AgentActivitySeverity
  readonly severityTone: AgentStatusTone
}
