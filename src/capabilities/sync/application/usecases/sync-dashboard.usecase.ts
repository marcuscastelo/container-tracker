import type { EnqueueSyncCommand } from '~/capabilities/sync/application/commands/enqueue-sync.command'
import type { CarrierDetectionWritePort } from '~/capabilities/sync/application/ports/carrier-detection-write.port'
import type {
  SyncQueuePort,
  SyncRequestStatusItem,
} from '~/capabilities/sync/application/ports/sync-queue.port'
import type { SyncEnqueuePolicyService } from '~/capabilities/sync/application/services/sync-enqueue-policy.service'
import type {
  ResolvedSyncTarget,
  SyncTargetResolverService,
} from '~/capabilities/sync/application/services/sync-target-resolver.service'
import {
  executeSyncTargets,
  isContainerNotFoundLikeStatus,
  waitForTerminalStatuses,
} from '~/capabilities/sync/application/usecases/sync-execution'
import type { CarrierDetectionEngine } from '~/capabilities/sync/carrier-detection/carrier-detection.engine'
import {
  normalizeContainerNumber,
  toPersistedCarrierCode,
} from '~/capabilities/sync/carrier-detection/carrier-detection.providers'
import { HttpError } from '~/shared/errors/httpErrors'

type SyncDashboardResult = {
  readonly syncedProcesses: number
  readonly syncedContainers: number
}

const DEFAULT_SYNC_TIMEOUT_MS = 180_000
const DEFAULT_SYNC_POLL_INTERVAL_MS = 5_000

type QueuedSyncDashboardRequest = {
  readonly processId: string | null
  readonly containerNumber: string
  readonly syncRequestId: string
}

export type SyncDashboardDeps = {
  readonly targetResolverService: SyncTargetResolverService
  readonly enqueuePolicyService: SyncEnqueuePolicyService
  readonly queuePort: Pick<SyncQueuePort, 'getSyncRequestStatuses'>
  readonly carrierDetectionEngine: CarrierDetectionEngine
  readonly carrierDetectionWritePort: CarrierDetectionWritePort
  readonly nowMs?: () => number
  readonly sleep?: (delayMs: number) => Promise<void>
  readonly timeoutMs?: number
  readonly pollIntervalMs?: number
}

function toFirstError(statuses: readonly SyncRequestStatusItem[], fallback: string): string {
  const firstFailure = statuses.find((status) => status.status !== 'DONE')
  if (!firstFailure) return fallback

  return (
    firstFailure.lastError ?? `${firstFailure.status.toLowerCase()}_${firstFailure.syncRequestId}`
  )
}

async function defaultSleep(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs)
  })
}

export function createSyncDashboardUseCase(deps: SyncDashboardDeps) {
  return async function execute(command: EnqueueSyncCommand): Promise<SyncDashboardResult> {
    if (command.scope.kind !== 'dashboard') {
      throw new HttpError('invalid_sync_scope_for_dashboard', 400)
    }

    const targets = await deps.targetResolverService.resolveTargets(command.scope)
    if (targets.length === 0) {
      return { syncedProcesses: 0, syncedContainers: 0 }
    }

    const syncedProcesses = new Set(targets.map((target) => target.processId)).size

    const enqueueResult = await deps.enqueuePolicyService.enqueue({
      tenantId: command.tenantId,
      mode: command.mode,
      targets,
    })

    if (enqueueResult.syncRequestIds.length === 0) {
      return {
        syncedProcesses,
        syncedContainers: targets.length,
      }
    }

    const initialStatuses = await waitForTerminalStatuses({
      syncRequestIds: enqueueResult.syncRequestIds,
      timeoutMs: deps.timeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS,
      pollIntervalMs: deps.pollIntervalMs ?? DEFAULT_SYNC_POLL_INTERVAL_MS,
      getSyncRequestStatuses: deps.queuePort.getSyncRequestStatuses,
      nowMs: deps.nowMs ?? Date.now,
      sleep: deps.sleep ?? defaultSleep,
      timeoutErrorMessage: 'sync_global_timeout',
    })

    const initialFailures = initialStatuses.filter((status) => status.status !== 'DONE')
    if (initialFailures.length === 0) {
      return {
        syncedProcesses,
        syncedContainers: targets.length,
      }
    }

    const nonDetectableFailures = initialFailures.filter(
      (status) => !isContainerNotFoundLikeStatus(status),
    )
    if (nonDetectableFailures.length > 0) {
      throw new HttpError(
        `sync_global_failed:${toFirstError(nonDetectableFailures, 'sync_failed')}`,
        502,
      )
    }

    const requestsBySyncRequestId = new Map<string, QueuedSyncDashboardRequest>(
      enqueueResult.requests.map((request) => [request.syncRequestId, request]),
    )

    const failedContainers = new Set<string>()
    for (const status of initialFailures) {
      const fromStatus =
        typeof status.refValue === 'string' && status.refValue.trim().length > 0
          ? normalizeContainerNumber(status.refValue)
          : null
      const fromRequest = requestsBySyncRequestId.get(status.syncRequestId)?.containerNumber
      const normalizedFromRequest =
        typeof fromRequest === 'string' && fromRequest.trim().length > 0
          ? normalizeContainerNumber(fromRequest)
          : null
      const resolvedContainer = fromStatus ?? normalizedFromRequest

      if (!resolvedContainer) {
        throw new HttpError(
          `sync_global_failed:container_not_resolved_for_${status.syncRequestId}`,
          502,
        )
      }

      failedContainers.add(resolvedContainer)
    }

    const retryTargets: ResolvedSyncTarget[] = []

    for (const containerNumber of failedContainers) {
      const relatedTargets = targets.filter(
        (target) => normalizeContainerNumber(target.containerNumber) === containerNumber,
      )
      if (relatedTargets.length === 0) {
        throw new HttpError(`sync_global_failed:target_not_resolved_for_${containerNumber}`, 502)
      }

      const excludeProviders = Array.from(new Set(relatedTargets.map((target) => target.provider)))
      const detectionResult = await deps.carrierDetectionEngine.detectCarrier({
        tenantId: command.tenantId,
        containerNumber,
        excludeProviders,
      })

      if (!detectionResult.detected) {
        throw new HttpError(
          `sync_global_failed:${detectionResult.error ?? detectionResult.reason}`,
          502,
        )
      }

      const processIds = Array.from(new Set(relatedTargets.map((target) => target.processId)))
      for (const processId of processIds) {
        await deps.carrierDetectionWritePort.persistDetectedCarrier({
          processId,
          containerNumber,
          carrierCode: toPersistedCarrierCode(detectionResult.provider),
        })
      }

      retryTargets.push({
        processId: processIds[0],
        containerNumber,
        provider: detectionResult.provider,
      })
    }

    const retryStatuses = await executeSyncTargets({
      tenantId: command.tenantId,
      mode: command.mode,
      targets: retryTargets,
      enqueuePolicyService: deps.enqueuePolicyService,
      queuePort: deps.queuePort,
      nowMs: deps.nowMs,
      sleep: deps.sleep,
      timeoutMs: deps.timeoutMs,
      pollIntervalMs: deps.pollIntervalMs,
      timeoutErrorMessage: 'sync_global_timeout',
    })

    const retryFailures = retryStatuses.filter((status) => status.status !== 'DONE')
    if (retryFailures.length > 0) {
      throw new HttpError(`sync_global_failed:${toFirstError(retryFailures, 'retry_failed')}`, 502)
    }

    return {
      syncedProcesses,
      syncedContainers: targets.length,
    }
  }
}
