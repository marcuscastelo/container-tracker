import type { EnqueueSyncCommand } from '~/capabilities/sync/application/commands/enqueue-sync.command'
import type {
  SyncQueuePort,
  SyncRequestStatusItem,
} from '~/capabilities/sync/application/ports/sync-queue.port'
import type { SyncEnqueuePolicyService } from '~/capabilities/sync/application/services/sync-enqueue-policy.service'
import type { SyncTargetResolverService } from '~/capabilities/sync/application/services/sync-target-resolver.service'
import { HttpError } from '~/shared/errors/httpErrors'
import { systemClock } from '~/shared/time/clock'

const DEFAULT_SYNC_TIMEOUT_MS = 180_000
const DEFAULT_SYNC_POLL_INTERVAL_MS = 5_000

type SyncDashboardResult = {
  readonly syncedProcesses: number
  readonly syncedContainers: number
}

export type SyncDashboardDeps = {
  readonly targetResolverService: SyncTargetResolverService
  readonly enqueuePolicyService: SyncEnqueuePolicyService
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

  return async function execute(command: EnqueueSyncCommand): Promise<SyncDashboardResult> {
    if (command.scope.kind !== 'dashboard') {
      throw new HttpError('invalid_sync_scope_for_dashboard', 400)
    }

    const targets = await deps.targetResolverService.resolveTargets(command.scope)
    if (targets.length === 0) {
      return { syncedProcesses: 0, syncedContainers: 0 }
    }

    const enqueueResult = await deps.enqueuePolicyService.enqueue({
      tenantId: command.tenantId,
      mode: command.mode,
      targets,
    })

    if (enqueueResult.syncRequestIds.length === 0) {
      return {
        syncedProcesses: new Set(targets.map((target) => target.processId).filter(Boolean)).size,
        syncedContainers: targets.length,
      }
    }

    const requests = await waitForTerminalStatuses({
      syncRequestIds: enqueueResult.syncRequestIds,
      timeoutMs,
      pollIntervalMs,
      getSyncRequestStatuses: deps.queuePort.getSyncRequestStatuses,
      nowMs,
      sleep,
    })

    const failures = requests.filter((request) => {
      return request.status === 'FAILED' || request.status === 'NOT_FOUND'
    })

    if (failures.length > 0) {
      const firstFailure = failures[0]
      const firstError =
        firstFailure.lastError ??
        `${firstFailure.status.toLowerCase()}_${firstFailure.syncRequestId}`
      throw new HttpError(`sync_global_failed:${firstError}`, 502)
    }

    const syncedProcesses = new Set(targets.map((target) => target.processId).filter(Boolean)).size

    return {
      syncedProcesses,
      syncedContainers: targets.length,
    }
  }
}
