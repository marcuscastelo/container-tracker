type SyncRequestStatus = 'PENDING' | 'LEASED' | 'DONE' | 'FAILED'

type ProcessSyncCandidate = {
  readonly processId: string
  readonly archivedAt: string | null
}

type SyncRequestRecord = {
  readonly containerNumber: string
  readonly status: SyncRequestStatus
  readonly createdAt: string
  readonly updatedAt: string
}

type ProcessSyncContainerRecord = {
  readonly containerNumber: string
}

export type ProcessSyncState = 'idle' | 'syncing' | 'completed' | 'failed'

export type ProcessSyncVisibility = 'active' | 'archived_in_flight'

export type ProcessSyncStateReadModel = {
  readonly processId: string
  readonly syncStatus: ProcessSyncState
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly containerCount: number
  readonly completedContainers: number
  readonly failedContainers: number
  readonly visibility: ProcessSyncVisibility
}

type ListProcessSyncStatesResult = {
  readonly generatedAt: string
  readonly processes: readonly ProcessSyncStateReadModel[]
}

export type ListProcessSyncStatesDeps = {
  readonly listProcessSyncCandidates: () => Promise<readonly ProcessSyncCandidate[]>
  readonly listContainersByProcessIds: (command: {
    readonly processIds: readonly string[]
  }) => Promise<{
    readonly containersByProcessId: ReadonlyMap<string, readonly ProcessSyncContainerRecord[]>
  }>
  readonly listSyncRequestsByContainerNumbers: (command: {
    readonly containerNumbers: readonly string[]
  }) => Promise<readonly SyncRequestRecord[]>
  readonly nowFactory?: () => Date
}

function normalizeContainerNumber(value: string): string {
  return value.trim().toUpperCase()
}

function isOpenStatus(status: SyncRequestStatus): boolean {
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

function deriveProcessSyncStatus(command: {
  readonly containerNumbers: readonly string[]
  readonly recordsByContainerNumber: ReadonlyMap<string, readonly SyncRequestRecord[]>
}): Omit<ProcessSyncStateReadModel, 'processId' | 'visibility'> {
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

export function createListProcessSyncStatesUseCase(deps: ListProcessSyncStatesDeps) {
  const nowFactory = deps.nowFactory ?? (() => new Date())

  return async function execute(): Promise<ListProcessSyncStatesResult> {
    const candidates = await deps.listProcessSyncCandidates()
    if (candidates.length === 0) {
      return {
        generatedAt: nowFactory().toISOString(),
        processes: [],
      }
    }

    const processIds = candidates.map((candidate) => candidate.processId)
    const { containersByProcessId } = await deps.listContainersByProcessIds({
      processIds,
    })

    const allContainerNumbers = Array.from(
      new Set(
        processIds.flatMap((processId) => {
          const containers = containersByProcessId.get(processId) ?? []
          return containers.map((container) => normalizeContainerNumber(container.containerNumber))
        }),
      ),
    )

    const syncRequests =
      allContainerNumbers.length === 0
        ? []
        : await deps.listSyncRequestsByContainerNumbers({ containerNumbers: allContainerNumbers })

    const recordsByContainerNumber = new Map<string, SyncRequestRecord[]>()
    for (const record of syncRequests) {
      const normalizedContainerNumber = normalizeContainerNumber(record.containerNumber)
      const records = recordsByContainerNumber.get(normalizedContainerNumber)
      if (records) {
        records.push(record)
        continue
      }
      recordsByContainerNumber.set(normalizedContainerNumber, [record])
    }

    const processStates: ProcessSyncStateReadModel[] = []
    for (const candidate of candidates) {
      const containers = containersByProcessId.get(candidate.processId) ?? []
      const containerNumbers = containers.map((container) =>
        normalizeContainerNumber(container.containerNumber),
      )

      const derived = deriveProcessSyncStatus({
        containerNumbers,
        recordsByContainerNumber,
      })

      const visibility: ProcessSyncVisibility =
        candidate.archivedAt === null ? 'active' : 'archived_in_flight'

      if (visibility === 'archived_in_flight' && derived.syncStatus !== 'syncing') {
        continue
      }

      processStates.push({
        processId: candidate.processId,
        visibility,
        ...derived,
      })
    }

    return {
      generatedAt: nowFactory().toISOString(),
      processes: processStates,
    }
  }
}

export type ListProcessSyncStatesUseCase = ReturnType<typeof createListProcessSyncStatesUseCase>
