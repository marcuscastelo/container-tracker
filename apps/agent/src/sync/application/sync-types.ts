export type SyncProcessingState = 'idle' | 'leasing' | 'processing' | 'backing_off' | 'unknown'

export type SyncLeaseHealth = 'healthy' | 'stale' | 'conflict' | 'unknown'

export type SyncRuntimeState = {
  processingState: SyncProcessingState
  leaseHealth: SyncLeaseHealth
  activeJobs: number
  queueLagSeconds: number | null
  lastError: string | null
}

export type SyncCycleActivity = {
  readonly type: 'REQUEST_FAILED' | 'LEASE_CONFLICT'
  readonly message: string
  readonly severity: 'warning' | 'danger'
  readonly metadata: Record<string, unknown>
}
