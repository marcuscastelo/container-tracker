export type SyncRequestRecord = {
  readonly containerNumber: string
  readonly status: 'PENDING' | 'LEASED' | 'DONE' | 'FAILED'
  readonly createdAt: string
  readonly updatedAt: string
}

export type ProcessSyncCandidate = {
  readonly processId: string
  readonly archivedAt: string | null
}

export type ProcessSyncContainerRecord = {
  readonly containerNumber: string
}

export type SyncStatusReadPort = {
  readonly listProcessSyncCandidates: () => Promise<readonly ProcessSyncCandidate[]>
  readonly listContainersByProcessIds: (command: {
    readonly processIds: readonly string[]
  }) => Promise<{
    readonly containersByProcessId: ReadonlyMap<string, readonly ProcessSyncContainerRecord[]>
  }>
  readonly listSyncRequestsByContainerNumbers: (command: {
    readonly containerNumbers: readonly string[]
  }) => Promise<readonly SyncRequestRecord[]>
}
