import type { SyncMode } from '~/capabilities/sync/application/commands/enqueue-sync.command'

export type SupportedSyncProvider = 'msc' | 'maersk' | 'cmacgm'

export type SyncRequestStatus = 'PENDING' | 'LEASED' | 'DONE' | 'FAILED' | 'NOT_FOUND'

export type SyncRequestStatusItem = {
  readonly syncRequestId: string
  readonly status: SyncRequestStatus
  readonly lastError: string | null
  readonly updatedAt: string | null
  readonly refValue: string | null
}

export type EnqueueSyncRequestResult = {
  readonly id: string
  readonly status: 'PENDING' | 'LEASED'
  readonly isNew: boolean
}

export type SyncQueuePort = {
  readonly enqueueContainerSyncRequest: (command: {
    readonly tenantId: string
    readonly provider: SupportedSyncProvider
    readonly containerNumber: string
    readonly mode: SyncMode
  }) => Promise<EnqueueSyncRequestResult>
  readonly getSyncRequestStatuses: (command: {
    readonly syncRequestIds: readonly string[]
  }) => Promise<{
    readonly allTerminal: boolean
    readonly requests: readonly SyncRequestStatusItem[]
  }>
}
