import type { SyncMetadataRepository } from '~/modules/tracking/application/ports/tracking.sync-metadata.repository'

export type ContainerSyncDTO = {
  readonly containerNumber: string
  readonly carrier: string | null
  readonly lastSuccessAt: string | null
  readonly lastAttemptAt: string | null
  readonly isSyncing: boolean
  readonly lastErrorCode: string | null
  readonly lastErrorAt: string | null
}

export type GetContainersSyncMetadataCommand = {
  readonly containerNumbers: readonly string[]
}

type GetContainersSyncMetadataDeps = {
  readonly syncMetadataRepository: SyncMetadataRepository
}

type MutableContainerSyncDTO = {
  containerNumber: string
  carrier: string | null
  lastSuccessAt: string | null
  lastAttemptAt: string | null
  isSyncing: boolean
  lastErrorCode: string | null
  lastErrorAt: string | null
}

function toTimestampOrNegativeInfinity(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
}

function isMoreRecent(candidate: string, current: string | null): boolean {
  if (current === null) return true
  return toTimestampOrNegativeInfinity(candidate) > toTimestampOrNegativeInfinity(current)
}

function isOpenStatus(status: 'PENDING' | 'LEASED' | 'DONE' | 'FAILED'): boolean {
  return status === 'PENDING' || status === 'LEASED'
}

export function normalizeContainerNumber(containerNumber: string): string {
  return containerNumber.trim().toUpperCase()
}

export function createContainerSyncMetadataFallback(containerNumber: string): ContainerSyncDTO {
  return {
    containerNumber,
    carrier: null,
    lastSuccessAt: null,
    lastAttemptAt: null,
    isSyncing: false,
    lastErrorCode: null,
    lastErrorAt: null,
  }
}

export function createGetContainersSyncMetadataUseCase(deps: GetContainersSyncMetadataDeps) {
  return async function execute(
    command: GetContainersSyncMetadataCommand,
  ): Promise<readonly ContainerSyncDTO[]> {
    const normalizedInput = command.containerNumbers.map(normalizeContainerNumber)
    const requestedContainerNumbers = Array.from(
      new Set(normalizedInput.filter((containerNumber) => containerNumber.length > 0)),
    )

    if (requestedContainerNumbers.length === 0) {
      return normalizedInput.map((containerNumber) =>
        createContainerSyncMetadataFallback(containerNumber),
      )
    }

    const metadataByContainerNumber = new Map<string, MutableContainerSyncDTO>(
      requestedContainerNumbers.map((containerNumber) => {
        const fallback = createContainerSyncMetadataFallback(containerNumber)
        return [containerNumber, { ...fallback }]
      }),
    )

    const metadataRows = await deps.syncMetadataRepository.listByContainerNumbers({
      containerNumbers: requestedContainerNumbers,
    })

    for (const row of metadataRows) {
      const containerNumber = normalizeContainerNumber(row.containerNumber)
      const current = metadataByContainerNumber.get(containerNumber)
      if (!current) continue

      if (isMoreRecent(row.createdAt, current.lastAttemptAt)) {
        current.lastAttemptAt = row.createdAt
        current.carrier = row.provider
      }

      if (isOpenStatus(row.status)) {
        current.isSyncing = true
      }

      if (row.status === 'DONE' && isMoreRecent(row.updatedAt, current.lastSuccessAt)) {
        current.lastSuccessAt = row.updatedAt
      }

      if (row.status === 'FAILED' && isMoreRecent(row.updatedAt, current.lastErrorAt)) {
        current.lastErrorAt = row.updatedAt
        current.lastErrorCode = row.lastError
      }
    }

    return normalizedInput.map((containerNumber) => {
      const metadata = metadataByContainerNumber.get(containerNumber)
      return metadata ? { ...metadata } : createContainerSyncMetadataFallback(containerNumber)
    })
  }
}
