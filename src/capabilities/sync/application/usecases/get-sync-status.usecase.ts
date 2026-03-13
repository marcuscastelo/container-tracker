import type { SyncStatusReadPort } from '~/capabilities/sync/application/ports/sync-status-read.port'
import {
  createSyncStatusAggregationService,
  type SyncStatusAggregationService,
} from '~/capabilities/sync/application/services/sync-status-aggregation.service'

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

export type GetSyncStatusResult = {
  readonly generatedAt: string
  readonly processes: readonly ProcessSyncStateReadModel[]
}

export type GetSyncStatusDeps = {
  readonly statusReadPort: SyncStatusReadPort
  readonly statusAggregationService?: SyncStatusAggregationService
  readonly nowFactory?: () => Date
}

export type GetSyncStatusCommand = {
  readonly processIds?: readonly string[]
}

export function createGetSyncStatusUseCase(deps: GetSyncStatusDeps) {
  const nowFactory = deps.nowFactory ?? (() => new Date())
  const aggregationService = deps.statusAggregationService ?? createSyncStatusAggregationService()

  return async function execute(command: GetSyncStatusCommand = {}): Promise<GetSyncStatusResult> {
    const candidates = await deps.statusReadPort.listProcessSyncCandidates({
      processIds: command.processIds,
    })
    if (candidates.length === 0) {
      return {
        generatedAt: nowFactory().toISOString(),
        processes: [],
      }
    }

    const processIds = candidates.map((candidate) => candidate.processId)
    const { containersByProcessId } = await deps.statusReadPort.listContainersByProcessIds({
      processIds,
    })

    const allContainerNumbers = Array.from(
      new Set(
        processIds.flatMap((processId) => {
          const containers = containersByProcessId.get(processId) ?? []
          return containers.map((container) =>
            aggregationService.normalizeContainerNumber(container.containerNumber),
          )
        }),
      ),
    )

    const syncRequests =
      allContainerNumbers.length === 0
        ? []
        : await deps.statusReadPort.listSyncRequestsByContainerNumbers({
            containerNumbers: allContainerNumbers,
          })

    const recordsByContainerNumber = aggregationService.mapRecordsByContainerNumber(syncRequests)

    const processes: ProcessSyncStateReadModel[] = []

    for (const candidate of candidates) {
      const containers = containersByProcessId.get(candidate.processId) ?? []
      const containerNumbers = containers.map((container) =>
        aggregationService.normalizeContainerNumber(container.containerNumber),
      )

      const derivedState = aggregationService.deriveProcessSyncState({
        containerNumbers,
        recordsByContainerNumber,
      })
      const visibility = aggregationService.deriveVisibility(candidate.archivedAt)

      if (visibility === 'archived_in_flight' && derivedState.syncStatus !== 'syncing') {
        continue
      }

      processes.push({
        processId: candidate.processId,
        visibility,
        ...derivedState,
      })
    }

    return {
      generatedAt: nowFactory().toISOString(),
      processes,
    }
  }
}
