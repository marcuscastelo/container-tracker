import type { SyncRequestRecord } from '~/capabilities/sync/application/ports/sync-status-read.port'

export type SyncStatusDerivedState = {
  readonly syncStatus: 'idle' | 'syncing' | 'completed' | 'failed'
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly containerCount: number
  readonly completedContainers: number
  readonly failedContainers: number
}

type SyncStatusAggregationService = {
  readonly normalizeContainerNumber: (value: string) => string
  readonly mapRecordsByContainerNumber: (
    records: readonly SyncRequestRecord[],
  ) => ReadonlyMap<string, readonly SyncRequestRecord[]>
  readonly deriveProcessSyncState: (command: {
    readonly containerNumbers: readonly string[]
    readonly recordsByContainerNumber: ReadonlyMap<string, readonly SyncRequestRecord[]>
  }) => SyncStatusDerivedState
  readonly deriveVisibility: (archivedAt: string | null) => 'active' | 'archived_in_flight'
}

function normalizeContainerNumber(value: string): string {
  return value.trim().toUpperCase()
}

function isOpenStatus(status: SyncRequestRecord['status']): boolean {
  return status === 'PENDING' || status === 'LEASED'
}

function toTimestampOrNegativeInfinity(value: string): number {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function pickLatestSyncRequest(
  current: SyncRequestRecord | null,
  candidate: SyncRequestRecord,
): SyncRequestRecord {
  if (current === null) return candidate

  const candidateUpdatedAtMs = toTimestampOrNegativeInfinity(candidate.updatedAt)
  const currentUpdatedAtMs = toTimestampOrNegativeInfinity(current.updatedAt)
  if (candidateUpdatedAtMs > currentUpdatedAtMs) return candidate
  if (candidateUpdatedAtMs < currentUpdatedAtMs) return current

  const candidateCreatedAtMs = toTimestampOrNegativeInfinity(candidate.createdAt)
  const currentCreatedAtMs = toTimestampOrNegativeInfinity(current.createdAt)
  if (candidateCreatedAtMs > currentCreatedAtMs) return candidate

  return current
}

function pickMinIso(current: string | null, candidate: string): string {
  if (current === null) return candidate
  return toTimestampOrNegativeInfinity(candidate) < toTimestampOrNegativeInfinity(current)
    ? candidate
    : current
}

function pickMaxIso(current: string | null, candidate: string): string {
  if (current === null) return candidate
  return toTimestampOrNegativeInfinity(candidate) > toTimestampOrNegativeInfinity(current)
    ? candidate
    : current
}

function mapRecordsByContainerNumber(
  records: readonly SyncRequestRecord[],
): ReadonlyMap<string, readonly SyncRequestRecord[]> {
  const byContainerNumber = new Map<string, SyncRequestRecord[]>()

  for (const record of records) {
    const normalizedContainerNumber = normalizeContainerNumber(record.containerNumber)
    const currentRecords = byContainerNumber.get(normalizedContainerNumber)

    if (currentRecords) {
      currentRecords.push(record)
      continue
    }

    byContainerNumber.set(normalizedContainerNumber, [record])
  }

  return byContainerNumber
}

function deriveProcessSyncState(command: {
  readonly containerNumbers: readonly string[]
  readonly recordsByContainerNumber: ReadonlyMap<string, readonly SyncRequestRecord[]>
}): SyncStatusDerivedState {
  const containerCount = command.containerNumbers.length
  if (containerCount === 0) {
    return {
      syncStatus: 'idle',
      startedAt: null,
      finishedAt: null,
      containerCount: 0,
      completedContainers: 0,
      failedContainers: 0,
    }
  }

  let processHasOpenRequests = false
  let completedContainers = 0
  let failedContainers = 0
  let startedAt: string | null = null
  let finishedAt: string | null = null

  for (const containerNumber of command.containerNumbers) {
    const records = command.recordsByContainerNumber.get(containerNumber) ?? []
    if (records.length === 0) {
      continue
    }

    let containerHasOpenRequests = false
    let latestRecord: SyncRequestRecord | null = null

    for (const record of records) {
      startedAt = pickMinIso(startedAt, record.createdAt)
      latestRecord = pickLatestSyncRequest(latestRecord, record)

      if (isOpenStatus(record.status)) {
        processHasOpenRequests = true
        containerHasOpenRequests = true
      }
    }

    if (containerHasOpenRequests || latestRecord === null) {
      continue
    }

    if (latestRecord.status === 'DONE') {
      completedContainers += 1
      finishedAt = pickMaxIso(finishedAt, latestRecord.updatedAt)
      continue
    }

    if (latestRecord.status === 'FAILED') {
      failedContainers += 1
      finishedAt = pickMaxIso(finishedAt, latestRecord.updatedAt)
    }
  }

  if (processHasOpenRequests) {
    return {
      syncStatus: 'syncing',
      startedAt,
      finishedAt: null,
      containerCount,
      completedContainers,
      failedContainers,
    }
  }

  if (failedContainers > 0) {
    return {
      syncStatus: 'failed',
      startedAt,
      finishedAt,
      containerCount,
      completedContainers,
      failedContainers,
    }
  }

  if (completedContainers === containerCount) {
    return {
      syncStatus: 'completed',
      startedAt,
      finishedAt,
      containerCount,
      completedContainers,
      failedContainers,
    }
  }

  return {
    syncStatus: 'idle',
    startedAt: null,
    finishedAt: null,
    containerCount,
    completedContainers,
    failedContainers,
  }
}

function deriveVisibility(archivedAt: string | null): 'active' | 'archived_in_flight' {
  return archivedAt === null ? 'active' : 'archived_in_flight'
}

export function createSyncStatusAggregationService(): SyncStatusAggregationService {
  return {
    normalizeContainerNumber,
    mapRecordsByContainerNumber,
    deriveProcessSyncState,
    deriveVisibility,
  }
}

export type { SyncStatusAggregationService }
