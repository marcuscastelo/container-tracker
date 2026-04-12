import type { SupportedSyncProvider } from '~/capabilities/sync/application/ports/sync-queue.port'

export type SyncDashboardSkippedReasonCode =
  | 'UNSUPPORTED_PROVIDER'
  | 'DUPLICATE_OPEN_REQUEST'
  | 'MISSING_REQUIRED_DATA'
  | 'INELIGIBLE_TARGET'

export type SyncDashboardFailedReasonCode =
  | 'ENQUEUE_FAILED'
  | 'INFRASTRUCTURE_ERROR'
  | 'UNEXPECTED_ERROR'

export type SyncDashboardBatchTargetBase = {
  readonly processId: string
  readonly processReference: string | null
  readonly containerNumber: string
  readonly provider: string
}

export type SyncDashboardEnqueuedTarget = SyncDashboardBatchTargetBase & {
  readonly provider: SupportedSyncProvider
  readonly syncRequestId: string
}

export type SyncDashboardSkippedTarget = SyncDashboardBatchTargetBase & {
  readonly reasonCode: SyncDashboardSkippedReasonCode
  readonly reasonMessage: string
}

export type SyncDashboardFailedTarget = SyncDashboardBatchTargetBase & {
  readonly reasonCode: SyncDashboardFailedReasonCode
  readonly reasonMessage: string
}

export type SyncDashboardBatchResult = {
  readonly summary: {
    readonly requestedProcesses: number
    readonly requestedContainers: number
    readonly enqueued: number
    readonly skipped: number
    readonly failed: number
  }
  readonly enqueuedTargets: readonly SyncDashboardEnqueuedTarget[]
  readonly skippedTargets: readonly SyncDashboardSkippedTarget[]
  readonly failedTargets: readonly SyncDashboardFailedTarget[]
}
