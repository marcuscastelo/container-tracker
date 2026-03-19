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

type SyncProcessResult = {
  readonly processId: string
  readonly syncedContainers: number
}

export type SyncProcessDeps = {
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

async function defaultSleep(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs)
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

  throw new HttpError('sync_process_timeout', 504)
}

export function createSyncProcessUseCase(deps: SyncProcessDeps) {
  const nowMs = deps.nowMs ?? (() => systemClock.now().toEpochMs())
  const sleep = deps.sleep ?? defaultSleep
  const timeoutMs = deps.timeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS
  const pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_SYNC_POLL_INTERVAL_MS

  return async function execute(command: EnqueueSyncCommand): Promise<SyncProcessResult> {
    if (command.scope.kind !== 'process') {
      throw new HttpError('invalid_sync_scope_for_process', 400)
    }

    const processId = command.scope.processId.trim()
    const targets = await deps.targetResolverService.resolveTargets(command.scope)

    if (targets.length === 0) {
      return {
        processId,
        syncedContainers: 0,
      }
    }

    const enqueueResult = await deps.enqueuePolicyService.enqueue({
      tenantId: command.tenantId,
      mode: command.mode,
      targets,
    })

    if (enqueueResult.syncRequestIds.length === 0) {
      return {
        processId,
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
      throw new HttpError(`sync_process_failed:${processId}:${firstError}`, 502)
    }

    return {
      processId,
      syncedContainers: targets.length,
    }
  }
}
