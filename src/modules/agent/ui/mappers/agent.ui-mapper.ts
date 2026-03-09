// ---------------------------------------------------------------------------
// Agent UI mapper — DTO -> ViewModel transformations.
// Pure functions, no side effects, no signal reads.
// ---------------------------------------------------------------------------

import type {
  AgentActivityEntry,
  AgentDetailPayload,
  AgentFleetSummary,
  AgentStatus,
  AgentSummaryPayload,
} from '~/modules/agent/ui/api/agent.api'
import type {
  AgentActivityVM,
  AgentDetailVM,
  AgentFleetSummaryVM,
  AgentListItemVM,
  AgentStatusTone,
  DiagnosticFlag,
} from '~/modules/agent/ui/vm/agent.vm'

// --- Helpers ---

function statusToTone(status: AgentStatus): AgentStatusTone {
  switch (status) {
    case 'CONNECTED':
      return 'success'
    case 'DEGRADED':
      return 'warning'
    case 'DISCONNECTED':
      return 'danger'
    case 'UNKNOWN':
      return 'neutral'
  }
}

function statusLabel(status: AgentStatus): string {
  switch (status) {
    case 'CONNECTED':
      return 'Connected'
    case 'DEGRADED':
      return 'Degraded'
    case 'DISCONNECTED':
      return 'Disconnected'
    case 'UNKNOWN':
      return 'Unknown'
  }
}

function realtimeLabel(state: string): string {
  switch (state) {
    case 'SUBSCRIBED':
      return 'Subscribed'
    case 'CHANNEL_ERROR':
      return 'Channel Error'
    case 'CONNECTING':
      return 'Connecting'
    default:
      return state
  }
}

function realtimeTone(state: string): AgentStatusTone {
  switch (state) {
    case 'SUBSCRIBED':
      return 'success'
    case 'CHANNEL_ERROR':
      return 'danger'
    case 'CONNECTING':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}

function relativeTime(iso: string | null, now: Date): string {
  if (!iso) return 'never'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return 'never'
    const diffMs = now.getTime() - d.getTime()
    if (diffMs < 0) return 'just now'
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 10) return 'just now'
    if (diffSec < 60) return `${diffSec}s ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDays = Math.floor(diffHr / 24)
    return `${diffDays}d ago`
  } catch {
    return '—'
  }
}

function freshnessBucket(iso: string | null, now: Date): 'fresh' | 'recent' | 'stale' | 'offline' {
  if (!iso) return 'offline'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return 'offline'
    const diffMs = now.getTime() - d.getTime()
    const diffSec = diffMs / 1000
    if (diffSec < 60) return 'fresh'
    if (diffSec < 300) return 'recent'
    if (diffSec < 900) return 'stale'
    return 'offline'
  } catch {
    return 'offline'
  }
}

function formatQueueLag(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds < 60) return `${seconds}s`
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function isProblematic(dto: AgentSummaryPayload): boolean {
  return (
    dto.status === 'DISCONNECTED' ||
    dto.status === 'DEGRADED' ||
    dto.failuresLastHour > 3 ||
    (dto.queueLagSeconds !== null && dto.queueLagSeconds > 30)
  )
}

function activityTypeLabel(type: string): string {
  switch (type) {
    case 'ENROLLED':
      return 'Enrolled'
    case 'HEARTBEAT':
      return 'Heartbeat'
    case 'LEASED_TARGET':
      return 'Leased Target'
    case 'SNAPSHOT_INGESTED':
      return 'Snapshot Ingested'
    case 'REQUEST_FAILED':
      return 'Request Failed'
    case 'REALTIME_SUBSCRIBED':
      return 'Realtime Subscribed'
    case 'REALTIME_CHANNEL_ERROR':
      return 'Realtime Error'
    case 'LEASE_CONFLICT':
      return 'Lease Conflict'
    default:
      return type
  }
}

function severityToTone(severity: string): AgentStatusTone {
  switch (severity) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'danger':
      return 'danger'
    default:
      return 'neutral'
  }
}

// --- Public mappers ---

export function toAgentListItemVM(dto: AgentSummaryPayload, now: Date): AgentListItemVM {
  return {
    agentId: dto.agentId,
    tenantName: dto.tenantName,
    hostname: dto.hostname,
    version: dto.version,
    status: statusLabel(dto.status),
    statusTone: statusToTone(dto.status),
    enrolledAtDisplay: formatDateTime(dto.enrolledAt),
    lastSeenDisplay: formatDateTime(dto.lastSeenAt),
    lastSeenRelative: relativeTime(dto.lastSeenAt, now),
    freshness: freshnessBucket(dto.lastSeenAt, now),
    activeJobs: dto.activeJobs,
    jobsLastHour: dto.jobsLastHour,
    failuresLastHour: dto.failuresLastHour,
    queueLagDisplay: formatQueueLag(dto.queueLagSeconds),
    capabilitiesDisplay: dto.capabilities.join(', '),
    realtimeLabel: realtimeLabel(dto.realtimeState),
    realtimeTone: realtimeTone(dto.realtimeState),
    isProblematic: isProblematic(dto),
  }
}

export function toFleetSummaryVM(summary: AgentFleetSummary): AgentFleetSummaryVM {
  return {
    totalAgents: summary.totalAgents,
    connected: summary.connectedCount,
    degraded: summary.degradedCount,
    disconnected: summary.disconnectedCount,
    totalActiveJobs: summary.totalActiveJobs,
    failuresLastHour: summary.totalFailuresLastHour,
    maxQueueLagDisplay: formatQueueLag(summary.maxQueueLagSeconds),
    tenantCount: summary.tenantCount,
  }
}

function mapActivity(entry: AgentActivityEntry, now: Date): AgentActivityVM {
  return {
    id: entry.id,
    occurredAtDisplay: formatDateTime(entry.occurredAt),
    occurredAtRelative: relativeTime(entry.occurredAt, now),
    type: entry.type,
    typeLabel: activityTypeLabel(entry.type),
    message: entry.message,
    severity: entry.severity,
    severityTone: severityToTone(entry.severity),
  }
}

function buildDiagnosticFlags(dto: AgentDetailPayload): readonly DiagnosticFlag[] {
  const flags: DiagnosticFlag[] = []

  if (dto.lastError) {
    flags.push({ label: 'Last error present', tone: 'danger' })
  }

  if (dto.leaseHealth === 'conflict') {
    flags.push({ label: 'Lease conflict detected', tone: 'warning' })
  }

  if (dto.leaseHealth === 'stale') {
    flags.push({ label: 'Stale lease', tone: 'warning' })
  }

  if (dto.realtimeState === 'CHANNEL_ERROR') {
    flags.push({ label: 'Realtime channel error', tone: 'danger' })
  }

  if (dto.realtimeState === 'CONNECTING') {
    flags.push({ label: 'Realtime not yet connected', tone: 'neutral' })
  }

  if (dto.queueLagSeconds !== null && dto.queueLagSeconds > 60) {
    flags.push({ label: 'High queue lag', tone: 'warning' })
  }

  if (dto.failuresLastHour > 3) {
    flags.push({ label: 'Elevated failure rate', tone: 'danger' })
  }

  if (dto.processingState === 'backing_off') {
    flags.push({ label: 'Backing off — rate limit suspected', tone: 'warning' })
  }

  return flags
}

function leaseHealthLabel(health: string): string {
  switch (health) {
    case 'healthy':
      return 'Healthy'
    case 'stale':
      return 'Stale'
    case 'conflict':
      return 'Conflict'
    case 'unknown':
      return 'Unknown'
    default:
      return health
  }
}

function leaseHealthTone(health: string): AgentStatusTone {
  switch (health) {
    case 'healthy':
      return 'success'
    case 'stale':
      return 'warning'
    case 'conflict':
      return 'danger'
    default:
      return 'neutral'
  }
}

function processingStateLabel(state: string): string {
  switch (state) {
    case 'idle':
      return 'Idle'
    case 'leasing':
      return 'Leasing'
    case 'processing':
      return 'Processing'
    case 'backing_off':
      return 'Backing Off'
    default:
      return state
  }
}

function enrollmentMethodLabel(method: string): string {
  switch (method) {
    case 'bootstrap-token':
      return 'Bootstrap Token'
    case 'manual':
      return 'Manual'
    default:
      return 'Unknown'
  }
}

export function toAgentDetailVM(dto: AgentDetailPayload, now: Date): AgentDetailVM {
  return {
    agentId: dto.agentId,
    tenantName: dto.tenantName,
    tenantId: dto.tenantId,
    hostname: dto.hostname,
    version: dto.version,

    status: statusLabel(dto.status),
    statusTone: statusToTone(dto.status),
    lastSeenDisplay: formatDateTime(dto.lastSeenAt),
    lastSeenRelative: relativeTime(dto.lastSeenAt, now),
    freshness: freshnessBucket(dto.lastSeenAt, now),
    realtimeLabel: realtimeLabel(dto.realtimeState),
    realtimeTone: realtimeTone(dto.realtimeState),
    leaseHealthLabel: leaseHealthLabel(dto.leaseHealth),
    leaseHealthTone: leaseHealthTone(dto.leaseHealth),
    processingStateLabel: processingStateLabel(dto.processingState),

    activeJobs: dto.activeJobs,
    jobsLastHour: dto.jobsLastHour,
    failuresLastHour: dto.failuresLastHour,
    avgJobDurationDisplay: formatDuration(dto.avgJobDurationMs),
    queueLagDisplay: formatQueueLag(dto.queueLagSeconds),

    enrolledAtDisplay: formatDateTime(dto.enrolledAt),
    enrollmentMethodLabel: enrollmentMethodLabel(dto.enrollmentMethod),
    tokenIdMasked: dto.tokenIdMasked ?? '—',
    intervalDisplay: dto.intervalSec !== null ? `${dto.intervalSec}s` : '—',
    capabilities: dto.capabilities,

    lastError: dto.lastError,
    diagnosticFlags: buildDiagnosticFlags(dto),

    recentActivity: dto.recentActivity.map((entry) => mapActivity(entry, now)),
  }
}
