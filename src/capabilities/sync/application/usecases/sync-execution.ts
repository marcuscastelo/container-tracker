import type { SyncMode } from '~/capabilities/sync/application/commands/enqueue-sync.command'
import type {
  SyncQueuePort,
  SyncRequestStatusItem,
} from '~/capabilities/sync/application/ports/sync-queue.port'
import type { SyncEnqueuePolicyService } from '~/capabilities/sync/application/services/sync-enqueue-policy.service'
import type { ResolvedSyncTarget } from '~/capabilities/sync/application/services/sync-target-resolver.service'
import { HttpError } from '~/shared/errors/httpErrors'

export const DEFAULT_SYNC_TIMEOUT_MS = 180_000
export const DEFAULT_SYNC_POLL_INTERVAL_MS = 5_000

export function isTerminalStatus(status: SyncRequestStatusItem['status']): boolean {
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

export async function waitForTerminalStatuses(command: {
  readonly syncRequestIds: readonly string[]
  readonly timeoutMs: number
  readonly pollIntervalMs: number
  readonly getSyncRequestStatuses: SyncQueuePort['getSyncRequestStatuses']
  readonly nowMs: () => number
  readonly sleep: (delayMs: number) => Promise<void>
  readonly timeoutErrorMessage: string
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

  throw new HttpError(command.timeoutErrorMessage, 504)
}

export async function executeSyncTargets(command: {
  readonly tenantId: string
  readonly mode: SyncMode
  readonly targets: readonly ResolvedSyncTarget[]
  readonly enqueuePolicyService: SyncEnqueuePolicyService
  readonly queuePort: Pick<SyncQueuePort, 'getSyncRequestStatuses'>
  readonly timeoutMs?: number
  readonly pollIntervalMs?: number
  readonly nowMs?: () => number
  readonly sleep?: (delayMs: number) => Promise<void>
  readonly timeoutErrorMessage: string
}): Promise<readonly SyncRequestStatusItem[]> {
  if (command.targets.length === 0) {
    return []
  }

  const enqueueResult = await command.enqueuePolicyService.enqueue({
    tenantId: command.tenantId,
    mode: command.mode,
    targets: command.targets,
  })

  if (enqueueResult.syncRequestIds.length === 0) {
    return []
  }

  return waitForTerminalStatuses({
    syncRequestIds: enqueueResult.syncRequestIds,
    timeoutMs: command.timeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS,
    pollIntervalMs: command.pollIntervalMs ?? DEFAULT_SYNC_POLL_INTERVAL_MS,
    getSyncRequestStatuses: command.queuePort.getSyncRequestStatuses,
    nowMs: command.nowMs ?? Date.now,
    sleep: command.sleep ?? defaultSleep,
    timeoutErrorMessage: command.timeoutErrorMessage,
  })
}

export function isContainerNotFoundLikeStatus(status: SyncRequestStatusItem): boolean {
  if (status.status === 'NOT_FOUND') {
    return true
  }

  const lastError = status.lastError?.toLowerCase().trim()
  if (!lastError) {
    return false
  }

  if (lastError === 'container_not_found') {
    return true
  }

  if (lastError.startsWith('container_not_found:')) {
    return true
  }

  if (lastError.includes(':container_not_found')) {
    return true
  }

  return lastError.startsWith('no container found for ')
}
