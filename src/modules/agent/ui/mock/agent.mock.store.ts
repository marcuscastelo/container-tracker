// ---------------------------------------------------------------------------
// Deterministic mock data for agent monitoring UI.
// All values are static — no Math.random() calls per render.
// ---------------------------------------------------------------------------

import type {
  AgentActivityEntry,
  AgentDetailPayload,
  AgentSummaryPayload,
} from '~/modules/agent/ui/mock/agent.mock'

// --- Fixtures: Agent summaries ---

const MOCK_AGENTS: readonly AgentSummaryPayload[] = [
  {
    agentId: 'agt-001',
    tenantId: 'tnt-castro',
    tenantName: 'Castro Aduaneira',
    hostname: 'agent-prod-br-01.castro.internal',
    version: '1.4.2',
    status: 'CONNECTED',
    enrolledAt: '2026-02-15T08:30:00Z',
    lastSeenAt: '2026-03-09T14:59:50Z',
    activeJobs: 3,
    jobsLastHour: 47,
    failuresLastHour: 0,
    avgJobDurationMs: 1230,
    queueLagSeconds: 2,
    capabilities: ['maersk', 'msc', 'cmacgm'],
    realtimeState: 'SUBSCRIBED',
  },
  {
    agentId: 'agt-002',
    tenantId: 'tnt-castro',
    tenantName: 'Castro Aduaneira',
    hostname: 'agent-prod-br-02.castro.internal',
    version: '1.4.2',
    status: 'CONNECTED',
    enrolledAt: '2026-02-15T08:32:00Z',
    lastSeenAt: '2026-03-09T14:59:45Z',
    activeJobs: 2,
    jobsLastHour: 39,
    failuresLastHour: 1,
    avgJobDurationMs: 1450,
    queueLagSeconds: 4,
    capabilities: ['maersk', 'hapag-lloyd'],
    realtimeState: 'SUBSCRIBED',
  },
  {
    agentId: 'agt-003',
    tenantId: 'tnt-castro',
    tenantName: 'Castro Aduaneira',
    hostname: 'agent-staging-br-01.castro.internal',
    version: '1.4.1',
    status: 'DEGRADED',
    enrolledAt: '2026-01-20T10:15:00Z',
    lastSeenAt: '2026-03-09T14:57:10Z',
    activeJobs: 1,
    jobsLastHour: 12,
    failuresLastHour: 5,
    avgJobDurationMs: 3200,
    queueLagSeconds: 45,
    capabilities: ['maersk'],
    realtimeState: 'CHANNEL_ERROR',
  },
  {
    agentId: 'agt-004',
    tenantId: 'tnt-bravo',
    tenantName: 'Bravo Logistics',
    hostname: 'bravo-agt-us-east-1a.bravo.io',
    version: '1.4.2',
    status: 'CONNECTED',
    enrolledAt: '2026-03-01T12:00:00Z',
    lastSeenAt: '2026-03-09T14:59:55Z',
    activeJobs: 5,
    jobsLastHour: 82,
    failuresLastHour: 0,
    avgJobDurationMs: 980,
    queueLagSeconds: 1,
    capabilities: ['maersk', 'msc', 'cmacgm', 'hapag-lloyd', 'one'],
    realtimeState: 'SUBSCRIBED',
  },
  {
    agentId: 'agt-005',
    tenantId: 'tnt-bravo',
    tenantName: 'Bravo Logistics',
    hostname: 'bravo-agt-eu-west-1a.bravo.io',
    version: '1.4.0',
    status: 'DISCONNECTED',
    enrolledAt: '2026-02-10T09:00:00Z',
    lastSeenAt: '2026-03-09T13:12:00Z',
    activeJobs: 0,
    jobsLastHour: 0,
    failuresLastHour: 0,
    avgJobDurationMs: null,
    queueLagSeconds: null,
    capabilities: ['maersk', 'msc'],
    realtimeState: 'CONNECTING',
  },
  {
    agentId: 'agt-006',
    tenantId: 'tnt-delta',
    tenantName: 'Delta Freight',
    hostname: 'delta-worker-01.delta-freight.com',
    version: '1.3.9',
    status: 'DEGRADED',
    enrolledAt: '2026-01-05T14:22:00Z',
    lastSeenAt: '2026-03-09T14:55:30Z',
    activeJobs: 0,
    jobsLastHour: 8,
    failuresLastHour: 6,
    avgJobDurationMs: 5100,
    queueLagSeconds: 120,
    capabilities: ['cmacgm'],
    realtimeState: 'CHANNEL_ERROR',
  },
  {
    agentId: 'agt-007',
    tenantId: 'tnt-delta',
    tenantName: 'Delta Freight',
    hostname: 'delta-worker-02.delta-freight.com',
    version: '1.4.2',
    status: 'CONNECTED',
    enrolledAt: '2026-03-05T16:00:00Z',
    lastSeenAt: '2026-03-09T14:59:58Z',
    activeJobs: 4,
    jobsLastHour: 55,
    failuresLastHour: 2,
    avgJobDurationMs: 1100,
    queueLagSeconds: 3,
    capabilities: ['maersk', 'cmacgm'],
    realtimeState: 'SUBSCRIBED',
  },
  {
    agentId: 'agt-008',
    tenantId: 'tnt-echo',
    tenantName: 'Echo Shipping',
    hostname: 'echo-agent-sg-01.echo-shipping.sg',
    version: '1.4.2',
    status: 'UNKNOWN',
    enrolledAt: '2026-03-08T20:00:00Z',
    lastSeenAt: '2026-03-08T20:01:00Z',
    activeJobs: 0,
    jobsLastHour: 0,
    failuresLastHour: 0,
    avgJobDurationMs: null,
    queueLagSeconds: null,
    capabilities: ['msc'],
    realtimeState: 'CONNECTING',
  },
] as const

// --- Fixtures: Agent detail extensions ---

function buildRecentActivity(agentId: string): readonly AgentActivityEntry[] {
  const base: Record<string, readonly AgentActivityEntry[]> = {
    'agt-001': [
      {
        id: 'ev-001a',
        occurredAt: '2026-03-09T14:59:50Z',
        type: 'HEARTBEAT',
        message: 'Heartbeat received',
        severity: 'info',
      },
      {
        id: 'ev-001b',
        occurredAt: '2026-03-09T14:58:20Z',
        type: 'SNAPSHOT_INGESTED',
        message: 'Snapshot ingested for MSKU1234567',
        severity: 'success',
      },
      {
        id: 'ev-001c',
        occurredAt: '2026-03-09T14:57:10Z',
        type: 'LEASED_TARGET',
        message: 'Leased target MSKU7654321 from queue',
        severity: 'info',
      },
      {
        id: 'ev-001d',
        occurredAt: '2026-03-09T14:55:00Z',
        type: 'SNAPSHOT_INGESTED',
        message: 'Snapshot ingested for TCLU9988776',
        severity: 'success',
      },
      {
        id: 'ev-001e',
        occurredAt: '2026-03-09T14:50:00Z',
        type: 'REALTIME_SUBSCRIBED',
        message: 'Subscribed to realtime channel',
        severity: 'info',
      },
      {
        id: 'ev-001f',
        occurredAt: '2026-03-09T08:30:02Z',
        type: 'ENROLLED',
        message: 'Agent enrolled via bootstrap-token',
        severity: 'success',
      },
    ],
    'agt-003': [
      {
        id: 'ev-003a',
        occurredAt: '2026-03-09T14:57:10Z',
        type: 'HEARTBEAT',
        message: 'Heartbeat received',
        severity: 'info',
      },
      {
        id: 'ev-003b',
        occurredAt: '2026-03-09T14:56:00Z',
        type: 'REQUEST_FAILED',
        message: 'Maersk API returned 502 Bad Gateway',
        severity: 'danger',
      },
      {
        id: 'ev-003c',
        occurredAt: '2026-03-09T14:54:30Z',
        type: 'REQUEST_FAILED',
        message: 'Maersk API returned 429 Too Many Requests',
        severity: 'danger',
      },
      {
        id: 'ev-003d',
        occurredAt: '2026-03-09T14:53:00Z',
        type: 'REALTIME_CHANNEL_ERROR',
        message: 'Channel reconnect failed — retrying in 30s',
        severity: 'warning',
      },
      {
        id: 'ev-003e',
        occurredAt: '2026-03-09T14:50:00Z',
        type: 'LEASED_TARGET',
        message: 'Leased target MSKU1111111 from queue',
        severity: 'info',
      },
      {
        id: 'ev-003f',
        occurredAt: '2026-03-09T14:48:00Z',
        type: 'REQUEST_FAILED',
        message: 'Timeout after 30s for MSKU2222222',
        severity: 'danger',
      },
    ],
    'agt-005': [
      {
        id: 'ev-005a',
        occurredAt: '2026-03-09T13:12:00Z',
        type: 'HEARTBEAT',
        message: 'Last heartbeat before disconnect',
        severity: 'warning',
      },
      {
        id: 'ev-005b',
        occurredAt: '2026-03-09T13:10:00Z',
        type: 'REALTIME_CHANNEL_ERROR',
        message: 'Connection lost',
        severity: 'danger',
      },
      {
        id: 'ev-005c',
        occurredAt: '2026-03-09T13:08:00Z',
        type: 'REQUEST_FAILED',
        message: 'Network error: ECONNRESET',
        severity: 'danger',
      },
    ],
    'agt-006': [
      {
        id: 'ev-006a',
        occurredAt: '2026-03-09T14:55:30Z',
        type: 'HEARTBEAT',
        message: 'Heartbeat received',
        severity: 'info',
      },
      {
        id: 'ev-006b',
        occurredAt: '2026-03-09T14:54:00Z',
        type: 'REQUEST_FAILED',
        message: 'CMA-CGM returned 503 Service Unavailable',
        severity: 'danger',
      },
      {
        id: 'ev-006c',
        occurredAt: '2026-03-09T14:52:00Z',
        type: 'REQUEST_FAILED',
        message: 'CMA-CGM returned 503 Service Unavailable',
        severity: 'danger',
      },
      {
        id: 'ev-006d',
        occurredAt: '2026-03-09T14:50:00Z',
        type: 'LEASE_CONFLICT',
        message: 'Lease conflict: target already leased by agt-007',
        severity: 'warning',
      },
      {
        id: 'ev-006e',
        occurredAt: '2026-03-09T14:48:00Z',
        type: 'REQUEST_FAILED',
        message: 'CMA-CGM timeout after 30s',
        severity: 'danger',
      },
      {
        id: 'ev-006f',
        occurredAt: '2026-03-09T14:45:00Z',
        type: 'REQUEST_FAILED',
        message: 'CMA-CGM returned 503 Service Unavailable',
        severity: 'danger',
      },
      {
        id: 'ev-006g',
        occurredAt: '2026-03-09T14:40:00Z',
        type: 'REALTIME_CHANNEL_ERROR',
        message: 'Channel error — degraded mode',
        severity: 'warning',
      },
    ],
    'agt-008': [
      {
        id: 'ev-008a',
        occurredAt: '2026-03-08T20:01:00Z',
        type: 'HEARTBEAT',
        message: 'Initial heartbeat',
        severity: 'info',
      },
      {
        id: 'ev-008b',
        occurredAt: '2026-03-08T20:00:00Z',
        type: 'ENROLLED',
        message: 'Agent enrolled via manual',
        severity: 'success',
      },
    ],
  }

  return (
    base[agentId] ?? [
      {
        id: `ev-${agentId}-a`,
        occurredAt: '2026-03-09T14:59:50Z',
        type: 'HEARTBEAT',
        message: 'Heartbeat received',
        severity: 'info' as const,
      },
      {
        id: `ev-${agentId}-b`,
        occurredAt: '2026-03-09T14:50:00Z',
        type: 'REALTIME_SUBSCRIBED',
        message: 'Subscribed to realtime channel',
        severity: 'info' as const,
      },
    ]
  )
}

const DETAIL_EXTENSIONS: Record<string, Omit<AgentDetailPayload, keyof AgentSummaryPayload>> = {
  'agt-001': {
    enrollmentMethod: 'bootstrap-token',
    tokenIdMasked: 'tok-****-a1b2',
    intervalSec: 30,
    processingState: 'processing',
    leaseHealth: 'healthy',
    lastError: null,
    recentActivity: buildRecentActivity('agt-001'),
  },
  'agt-002': {
    enrollmentMethod: 'bootstrap-token',
    tokenIdMasked: 'tok-****-c3d4',
    intervalSec: 30,
    processingState: 'processing',
    leaseHealth: 'healthy',
    lastError: null,
    recentActivity: buildRecentActivity('agt-002'),
  },
  'agt-003': {
    enrollmentMethod: 'bootstrap-token',
    tokenIdMasked: 'tok-****-e5f6',
    intervalSec: 60,
    processingState: 'backing_off',
    leaseHealth: 'stale',
    lastError: 'Maersk API returned 502 Bad Gateway',
    recentActivity: buildRecentActivity('agt-003'),
  },
  'agt-004': {
    enrollmentMethod: 'bootstrap-token',
    tokenIdMasked: 'tok-****-g7h8',
    intervalSec: 30,
    processingState: 'processing',
    leaseHealth: 'healthy',
    lastError: null,
    recentActivity: buildRecentActivity('agt-004'),
  },
  'agt-005': {
    enrollmentMethod: 'bootstrap-token',
    tokenIdMasked: 'tok-****-i9j0',
    intervalSec: 30,
    processingState: 'idle',
    leaseHealth: 'unknown',
    lastError: 'Network error: ECONNRESET',
    recentActivity: buildRecentActivity('agt-005'),
  },
  'agt-006': {
    enrollmentMethod: 'manual',
    tokenIdMasked: null,
    intervalSec: 60,
    processingState: 'backing_off',
    leaseHealth: 'conflict',
    lastError: 'CMA-CGM returned 503 Service Unavailable',
    recentActivity: buildRecentActivity('agt-006'),
  },
  'agt-007': {
    enrollmentMethod: 'bootstrap-token',
    tokenIdMasked: 'tok-****-k1l2',
    intervalSec: 30,
    processingState: 'processing',
    leaseHealth: 'healthy',
    lastError: null,
    recentActivity: buildRecentActivity('agt-007'),
  },
  'agt-008': {
    enrollmentMethod: 'manual',
    tokenIdMasked: null,
    intervalSec: null,
    processingState: 'idle',
    leaseHealth: 'unknown',
    lastError: null,
    recentActivity: buildRecentActivity('agt-008'),
  },
}

// --- Public API ---

export function getMockAgents(): readonly AgentSummaryPayload[] {
  return MOCK_AGENTS
}

export function getMockAgentDetail(agentId: string): AgentDetailPayload | null {
  const summary = MOCK_AGENTS.find((a) => a.agentId === agentId)
  if (!summary) return null
  const ext = DETAIL_EXTENSIONS[agentId]
  if (!ext) return null
  return { ...summary, ...ext }
}
