import type { SyncMode } from '~/capabilities/sync/application/commands/enqueue-sync.command'
import type { SyncQueuePort } from '~/capabilities/sync/application/ports/sync-queue.port'
import type { DashboardSyncEligibleTarget } from '~/capabilities/sync/application/services/sync-dashboard-targets.service'
import type {
  SyncDashboardEnqueuedTarget,
  SyncDashboardFailedTarget,
  SyncDashboardSkippedTarget,
} from '~/capabilities/sync/application/usecases/sync-dashboard-batch-result'

const DUPLICATE_OPEN_REQUEST_MESSAGE =
  'Target already has an open sync request or was already included in this batch.'
const ENQUEUE_FAILED_MESSAGE = 'Failed to enqueue dashboard sync request.'

type SyncDashboardEnqueueResult = {
  readonly enqueuedTargets: readonly SyncDashboardEnqueuedTarget[]
  readonly skippedTargets: readonly SyncDashboardSkippedTarget[]
  readonly failedTargets: readonly SyncDashboardFailedTarget[]
  readonly newSyncRequestIds: readonly string[]
}

type SyncDashboardEnqueueService = {
  readonly enqueue: (command: {
    readonly tenantId: string
    readonly mode: SyncMode
    readonly targets: readonly DashboardSyncEligibleTarget[]
  }) => Promise<SyncDashboardEnqueueResult>
}

type UniqueEnqueueOutcome =
  | {
      readonly kind: 'enqueued'
      readonly syncRequestId: string
    }
  | {
      readonly kind: 'skipped'
    }
  | {
      readonly kind: 'failed'
    }

function toTargetKey(target: DashboardSyncEligibleTarget): string {
  return `${target.provider}:${target.containerNumber}`
}

export function createSyncDashboardEnqueueService(deps: {
  readonly queuePort: SyncQueuePort
}): SyncDashboardEnqueueService {
  return {
    async enqueue(command) {
      if (command.targets.length === 0) {
        return {
          enqueuedTargets: [],
          skippedTargets: [],
          failedTargets: [],
          newSyncRequestIds: [],
        }
      }

      const firstTargetByKey = new Map<string, DashboardSyncEligibleTarget>()

      for (const target of command.targets) {
        const key = toTargetKey(target)
        if (firstTargetByKey.has(key)) {
          continue
        }

        firstTargetByKey.set(key, target)
      }

      const uniqueOutcomes = await Promise.all(
        Array.from(firstTargetByKey.entries()).map(
          async ([key, target]): Promise<readonly [string, UniqueEnqueueOutcome]> => {
          try {
            const enqueueResult = await deps.queuePort.enqueueContainerSyncRequest({
              tenantId: command.tenantId,
              mode: command.mode,
              provider: target.provider,
              containerNumber: target.containerNumber,
            })

            if (!enqueueResult.isNew) {
              return [key, { kind: 'skipped' }] as const
            }

            return [
              key,
              {
                kind: 'enqueued',
                syncRequestId: enqueueResult.id,
              },
            ] as const
          } catch {
            return [key, { kind: 'failed' }] as const
          }
        }),
      )

      const outcomeByKey = new Map<string, UniqueEnqueueOutcome>(uniqueOutcomes)
      const duplicateCountByKey = new Map<string, number>()
      const enqueuedTargets: SyncDashboardEnqueuedTarget[] = []
      const skippedTargets: SyncDashboardSkippedTarget[] = []
      const failedTargets: SyncDashboardFailedTarget[] = []

      for (const target of command.targets) {
        const key = toTargetKey(target)
        const firstOccurrenceCount = duplicateCountByKey.get(key) ?? 0
        duplicateCountByKey.set(key, firstOccurrenceCount + 1)

        if (firstOccurrenceCount > 0) {
          skippedTargets.push({
            processId: target.processId,
            processReference: target.processReference,
            containerNumber: target.containerNumber,
            provider: target.provider,
            reasonCode: 'DUPLICATE_OPEN_REQUEST',
            reasonMessage: DUPLICATE_OPEN_REQUEST_MESSAGE,
          })
          continue
        }

        const outcome = outcomeByKey.get(key)
        if (outcome === undefined) {
          failedTargets.push({
            processId: target.processId,
            processReference: target.processReference,
            containerNumber: target.containerNumber,
            provider: target.provider,
            reasonCode: 'UNEXPECTED_ERROR',
            reasonMessage: ENQUEUE_FAILED_MESSAGE,
          })
          continue
        }

        if (outcome.kind === 'skipped') {
          skippedTargets.push({
            processId: target.processId,
            processReference: target.processReference,
            containerNumber: target.containerNumber,
            provider: target.provider,
            reasonCode: 'DUPLICATE_OPEN_REQUEST',
            reasonMessage: DUPLICATE_OPEN_REQUEST_MESSAGE,
          })
          continue
        }

        if (outcome.kind === 'failed') {
          failedTargets.push({
            processId: target.processId,
            processReference: target.processReference,
            containerNumber: target.containerNumber,
            provider: target.provider,
            reasonCode: 'ENQUEUE_FAILED',
            reasonMessage: ENQUEUE_FAILED_MESSAGE,
          })
          continue
        }

        enqueuedTargets.push({
          processId: target.processId,
          processReference: target.processReference,
          containerNumber: target.containerNumber,
          provider: target.provider,
          syncRequestId: outcome.syncRequestId,
        })
      }

      return {
        enqueuedTargets,
        skippedTargets,
        failedTargets,
        newSyncRequestIds: enqueuedTargets.map((target) => target.syncRequestId),
      }
    },
  }
}

export type { SyncDashboardEnqueueService }
