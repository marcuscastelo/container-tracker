import type { SyncMode } from '~/capabilities/sync/application/commands/enqueue-sync.command'
import type { SyncQueuePort } from '~/capabilities/sync/application/ports/sync-queue.port'
import type { ResolvedSyncTarget } from '~/capabilities/sync/application/services/sync-target-resolver.service'

type QueuedSyncTarget = {
  readonly processId: string | null
  readonly containerNumber: string
  readonly syncRequestId: string
  readonly deduped: boolean
}

type EnqueueSyncPolicyResult = {
  readonly requestedTargets: number
  readonly queuedTargets: number
  readonly syncRequestIds: readonly string[]
  readonly requests: readonly QueuedSyncTarget[]
}

type SyncEnqueuePolicyService = {
  readonly enqueue: (command: {
    readonly tenantId: string
    readonly mode: SyncMode
    readonly targets: readonly ResolvedSyncTarget[]
  }) => Promise<EnqueueSyncPolicyResult>
}

type EnqueueExecution = Awaited<ReturnType<SyncQueuePort['enqueueContainerSyncRequest']>>

function dedupeKey(target: ResolvedSyncTarget): string {
  return `${target.provider}:${target.containerNumber}`
}

export function createSyncEnqueuePolicyService(deps: {
  readonly queuePort: SyncQueuePort
}): SyncEnqueuePolicyService {
  return {
    async enqueue(command) {
      if (command.targets.length === 0) {
        return {
          requestedTargets: 0,
          queuedTargets: 0,
          syncRequestIds: [],
          requests: [],
        }
      }

      const firstTargetIndexByKey = new Map<string, number>()
      const uniqueTargets: ResolvedSyncTarget[] = []

      for (let index = 0; index < command.targets.length; index += 1) {
        const target = command.targets[index]
        if (!target) continue

        const key = dedupeKey(target)
        if (firstTargetIndexByKey.has(key)) {
          continue
        }

        firstTargetIndexByKey.set(key, index)
        uniqueTargets.push(target)
      }

      // Current policy: dedupe by provider+container and enqueue once per unique key.
      // Future rate-limit/protection rules should be applied before Promise.all dispatch.
      const uniqueEnqueueResults = await Promise.all(
        uniqueTargets.map(async (target) => ({
          key: dedupeKey(target),
          target,
          enqueue: await deps.queuePort.enqueueContainerSyncRequest({
            tenantId: command.tenantId,
            mode: command.mode,
            provider: target.provider,
            containerNumber: target.containerNumber,
          }),
        })),
      )

      const enqueueByKey = new Map<
        string,
        {
          readonly target: ResolvedSyncTarget
          readonly enqueue: EnqueueExecution
        }
      >()
      for (const result of uniqueEnqueueResults) {
        enqueueByKey.set(result.key, {
          target: result.target,
          enqueue: result.enqueue,
        })
      }

      const occurrencesByKey = new Map<string, number>()
      const requests: QueuedSyncTarget[] = []

      for (const target of command.targets) {
        const key = dedupeKey(target)
        const queueResult = enqueueByKey.get(key)
        if (!queueResult) continue

        const previousOccurrences = occurrencesByKey.get(key) ?? 0
        occurrencesByKey.set(key, previousOccurrences + 1)

        requests.push({
          processId: target.processId,
          containerNumber: target.containerNumber,
          syncRequestId: queueResult.enqueue.id,
          deduped: previousOccurrences > 0 || !queueResult.enqueue.isNew,
        })
      }

      return {
        requestedTargets: command.targets.length,
        queuedTargets: uniqueTargets.length,
        syncRequestIds: Array.from(new Set(requests.map((request) => request.syncRequestId))),
        requests,
      }
    },
  }
}

export type { SyncEnqueuePolicyService }
