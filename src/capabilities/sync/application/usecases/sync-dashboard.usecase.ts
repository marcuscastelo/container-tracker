import type { EnqueueSyncCommand } from '~/capabilities/sync/application/commands/enqueue-sync.command'
import type {
  SyncQueuePort,
  SyncRequestStatusItem,
} from '~/capabilities/sync/application/ports/sync-queue.port'
import type { SyncDashboardEnqueueService } from '~/capabilities/sync/application/services/sync-dashboard-enqueue.service'
import type { SyncDashboardTargetsService } from '~/capabilities/sync/application/services/sync-dashboard-targets.service'
import type {
  SyncDashboardBatchResult,
  SyncDashboardFailedTarget,
} from '~/capabilities/sync/application/usecases/sync-dashboard-batch-result'
import { HttpError } from '~/shared/errors/httpErrors'
import { systemClock } from '~/shared/time/clock'

const DEFAULT_SYNC_TIMEOUT_MS = 180_000
const DEFAULT_SYNC_POLL_INTERVAL_MS = 5_000
const TERMINAL_ENQUEUE_FAILED_MESSAGE = 'Dashboard sync request failed after enqueue.'
const TERMINAL_INFRASTRUCTURE_ERROR_MESSAGE =
  'Dashboard sync request status could not be reconciled.'

export type SyncDashboardDeps = {
  readonly dashboardTargetsService: SyncDashboardTargetsService
  readonly dashboardEnqueueService: SyncDashboardEnqueueService
  readonly queuePort: Pick<SyncQueuePort, 'getSyncRequestStatuses'>
  readonly nowMs?: () => number
  readonly sleep?: (delayMs: number) => Promise<void>
  readonly timeoutMs?: number
  readonly pollIntervalMs?: number
}

function isTerminalStatus(status: SyncRequestStatusItem['status']): boolean {
  return status === 'DONE' || status === 'FAILED' || status === 'NOT_FOUND'
}

async function defaultSleep(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs)
  })
}

function toTerminalStatusItems(
  syncRequestIds: readonly string[],
  requests: readonly SyncRequestStatusItem[],
): readonly SyncRequestStatusItem[] {
  const byId = new Map(requests.map((request) => [request.syncRequestId, request]))

  return syncRequestIds.map((syncRequestId) => {
    const request = byId.get(syncRequestId)
    if (request) return request

    return {
      syncRequestId,
      status: 'NOT_FOUND',
      lastError: 'sync_request_not_found',
      updatedAt: null,
      refValue: null,
    }
  })
}

async function waitForTerminalStatuses(command: {
  readonly syncRequestIds: readonly string[]
  readonly timeoutMs: number
  readonly pollIntervalMs: number
  readonly getSyncRequestStatuses: SyncQueuePort['getSyncRequestStatuses']
  readonly nowMs: () => number
  readonly sleep: (delayMs: number) => Promise<void>
}): Promise<readonly SyncRequestStatusItem[]> {
  let lastProgressAtMs = command.nowMs()
  let highestDoneCount = 0

  while (true) {
    const response = await command.getSyncRequestStatuses({
      syncRequestIds: command.syncRequestIds,
    })

    const requests = toTerminalStatusItems(command.syncRequestIds, response.requests)
    const doneCount = requests.filter((request) => request.status === 'DONE').length
    if (doneCount > highestDoneCount) {
      highestDoneCount = doneCount
      lastProgressAtMs = command.nowMs()
    }

    if (requests.every((request) => isTerminalStatus(request.status))) {
      return requests
    }

    const nowMs = command.nowMs()
    const idleMs = nowMs - lastProgressAtMs
    if (idleMs >= command.timeoutMs) {
      break
    }

    const remainingMs = command.timeoutMs - idleMs
    await command.sleep(Math.min(command.pollIntervalMs, remainingMs))
  }

  throw new HttpError('sync_global_timeout', 504)
}

export function createSyncDashboardUseCase(deps: SyncDashboardDeps) {
  const nowMs = deps.nowMs ?? (() => systemClock.now().toEpochMs())
  const sleep = deps.sleep ?? defaultSleep
  const timeoutMs = deps.timeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS
  const pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_SYNC_POLL_INTERVAL_MS

  function toFailedTargetFromTerminalStatus(command: {
    readonly statusItem: SyncRequestStatusItem
    readonly enqueuedTarget: SyncDashboardBatchResult['enqueuedTargets'][number]
  }): SyncDashboardFailedTarget {
    if (command.statusItem.status === 'NOT_FOUND') {
      return {
        processId: command.enqueuedTarget.processId,
        processReference: command.enqueuedTarget.processReference,
        containerNumber: command.enqueuedTarget.containerNumber,
        provider: command.enqueuedTarget.provider,
        reasonCode: 'INFRASTRUCTURE_ERROR',
        reasonMessage: TERMINAL_INFRASTRUCTURE_ERROR_MESSAGE,
      }
    }

    return {
      processId: command.enqueuedTarget.processId,
      processReference: command.enqueuedTarget.processReference,
      containerNumber: command.enqueuedTarget.containerNumber,
      provider: command.enqueuedTarget.provider,
      reasonCode: 'ENQUEUE_FAILED',
      reasonMessage: TERMINAL_ENQUEUE_FAILED_MESSAGE,
    }
  }

  function logBatchResult(result: SyncDashboardBatchResult): void {
    const reasonHistogram: Record<string, number> = {}
    for (const target of [...result.skippedTargets, ...result.failedTargets]) {
      reasonHistogram[target.reasonCode] = (reasonHistogram[target.reasonCode] ?? 0) + 1
    }

    for (const target of result.skippedTargets) {
      console.warn('[sync_dashboard_target_skipped]', {
        processId: target.processId,
        processReference: target.processReference,
        containerNumber: target.containerNumber,
        provider: target.provider,
        reasonCode: target.reasonCode,
      })
    }

    for (const target of result.failedTargets) {
      console.error('[sync_dashboard_target_failed]', {
        processId: target.processId,
        processReference: target.processReference,
        containerNumber: target.containerNumber,
        provider: target.provider,
        reasonCode: target.reasonCode,
      })
    }

    console.info('[sync_dashboard_batch]', {
      requestedProcesses: result.summary.requestedProcesses,
      requestedContainers: result.summary.requestedContainers,
      enqueued: result.summary.enqueued,
      skipped: result.summary.skipped,
      failed: result.summary.failed,
      reasonHistogram,
    })
  }

  return async function execute(command: EnqueueSyncCommand): Promise<SyncDashboardBatchResult> {
    if (command.scope.kind !== 'dashboard') {
      throw new HttpError('invalid_sync_scope_for_dashboard', 400)
    }

    const resolvedTargets = await deps.dashboardTargetsService.resolveTargets()
    const enqueueResult = await deps.dashboardEnqueueService.enqueue({
      tenantId: command.tenantId,
      mode: command.mode,
      targets: resolvedTargets.eligibleTargets,
    })

    let enqueuedTargets: SyncDashboardBatchResult['enqueuedTargets'][number][] = [
      ...enqueueResult.enqueuedTargets,
    ]
    const skippedTargets: SyncDashboardBatchResult['skippedTargets'][number][] = [
      ...resolvedTargets.skippedTargets,
      ...enqueueResult.skippedTargets,
    ]
    const failedTargets: SyncDashboardBatchResult['failedTargets'][number][] = [
      ...enqueueResult.failedTargets,
    ]

    if (enqueueResult.newSyncRequestIds.length > 0) {
      const requests = await waitForTerminalStatuses({
        syncRequestIds: enqueueResult.newSyncRequestIds,
        timeoutMs,
        pollIntervalMs,
        getSyncRequestStatuses: deps.queuePort.getSyncRequestStatuses,
        nowMs,
        sleep,
      })

      const failedBySyncRequestId = new Map(
        requests
          .filter((request) => request.status === 'FAILED' || request.status === 'NOT_FOUND')
          .map((request) => [request.syncRequestId, request] as const),
      )

      if (failedBySyncRequestId.size > 0) {
        const survivingTargets: SyncDashboardBatchResult['enqueuedTargets'][number][] = []
        for (const target of enqueuedTargets) {
          const failedRequest = failedBySyncRequestId.get(target.syncRequestId)
          if (failedRequest === undefined) {
            survivingTargets.push(target)
            continue
          }

          failedTargets.push(
            toFailedTargetFromTerminalStatus({
              statusItem: failedRequest,
              enqueuedTarget: target,
            }),
          )
        }
        enqueuedTargets = survivingTargets
      }
    }

    const result: SyncDashboardBatchResult = {
      summary: {
        requestedProcesses: resolvedTargets.requestedProcesses,
        requestedContainers: resolvedTargets.requestedContainers,
        enqueued: enqueuedTargets.length,
        skipped: skippedTargets.length,
        failed: failedTargets.length,
      },
      enqueuedTargets,
      skippedTargets,
      failedTargets,
    }

    logBatchResult(result)
    return result
  }
}
