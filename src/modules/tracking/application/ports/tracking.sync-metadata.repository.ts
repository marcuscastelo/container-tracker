export type SyncRequestOperationalStatus = 'PENDING' | 'LEASED' | 'DONE' | 'FAILED'

export type SyncMetadataRecord = {
  readonly containerNumber: string
  readonly provider: string | null
  readonly status: SyncRequestOperationalStatus
  readonly createdAt: string
  readonly updatedAt: string
  readonly lastError: string | null
}

/**
 * Repository for operational sync metadata only.
 *
 * This port is not part of tracking semantic derivation
 * (timeline/status/alerts); it only supports operational visibility.
 */
export type SyncMetadataRepository = {
  listByContainerNumbers(command: {
    readonly containerNumbers: readonly string[]
  }): Promise<readonly SyncMetadataRecord[]>
}
