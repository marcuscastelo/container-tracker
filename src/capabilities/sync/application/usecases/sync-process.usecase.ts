import type { CarrierDetectionWritePort } from '~/capabilities/sync/application/ports/carrier-detection-write.port'
import type {
  SyncQueuePort,
  SyncRequestStatusItem,
} from '~/capabilities/sync/application/ports/sync-queue.port'
import type { SyncTargetReadPort } from '~/capabilities/sync/application/ports/sync-target-read.port'
import type { SyncEnqueuePolicyService } from '~/capabilities/sync/application/services/sync-enqueue-policy.service'
import type { ResolvedSyncTarget } from '~/capabilities/sync/application/services/sync-target-resolver.service'
import {
  executeSyncTargets,
  isContainerNotFoundLikeStatus,
} from '~/capabilities/sync/application/usecases/sync-execution'
import type { CarrierDetectionEngine } from '~/capabilities/sync/carrier-detection/carrier-detection.engine'
import {
  normalizeContainerNumber,
  toPersistedCarrierCode,
  toSupportedSyncProvider,
} from '~/capabilities/sync/carrier-detection/carrier-detection.providers'
import { HttpError } from '~/shared/errors/httpErrors'

type SyncProcessResult = {
  readonly processId: string
  readonly syncedContainers: number
}

type SyncProcessContainerRecord = {
  readonly containerId?: string
  readonly processId: string
  readonly containerNumber: string
  readonly carrierCode: string | null
}

export type SyncProcessDeps = {
  readonly targetReadPort: Pick<
    SyncTargetReadPort,
    'fetchProcessById' | 'listContainersByProcessId'
  >
  readonly enqueuePolicyService: SyncEnqueuePolicyService
  readonly queuePort: Pick<SyncQueuePort, 'getSyncRequestStatuses'>
  readonly carrierDetectionEngine: CarrierDetectionEngine
  readonly carrierDetectionWritePort: CarrierDetectionWritePort
  readonly nowMs?: () => number
  readonly sleep?: (delayMs: number) => Promise<void>
  readonly timeoutMs?: number
  readonly pollIntervalMs?: number
}

function toDetectionRunStatus(
  detectionResult: Awaited<ReturnType<CarrierDetectionEngine['detectCarrier']>>,
): 'RESOLVED' | 'FAILED' | 'RATE_LIMITED' {
  if (detectionResult.detected) return 'RESOLVED'
  if (detectionResult.reason === 'rate_limited') return 'RATE_LIMITED'
  return 'FAILED'
}

function toDetectionConfidence(
  detectionResult: Awaited<ReturnType<CarrierDetectionEngine['detectCarrier']>>,
): 'HIGH' | 'LOW' | 'UNKNOWN' {
  if (detectionResult.detected) return 'HIGH'
  if (detectionResult.reason === 'rate_limited') return 'UNKNOWN'
  return 'LOW'
}

function toDetectionAttempts(
  detectionResult: Awaited<ReturnType<CarrierDetectionEngine['detectCarrier']>>,
) {
  if (detectionResult.attempts && detectionResult.attempts.length > 0) {
    return detectionResult.attempts.map((attempt) => ({
      provider: attempt.provider,
      status: attempt.status,
      errorCode: attempt.errorCode,
      rawResultRef: attempt.rawResultRef,
    }))
  }

  if (detectionResult.detected) {
    return [
      {
        provider: detectionResult.provider,
        status: 'FOUND' as const,
        errorCode: null,
        rawResultRef: null,
      },
    ]
  }

  return detectionResult.attemptedProviders.map((provider) => ({
    provider,
    status: 'NOT_FOUND' as const,
    errorCode: detectionResult.error,
    rawResultRef: null,
  }))
}

function dedupeTargets(targets: readonly ResolvedSyncTarget[]): readonly ResolvedSyncTarget[] {
  const byKey = new Map<string, ResolvedSyncTarget>()

  for (const target of targets) {
    const key = `${target.provider}:${target.containerNumber}`
    if (!byKey.has(key)) {
      byKey.set(key, target)
    }
  }

  return Array.from(byKey.values())
}

function toSyncTargets(
  records: readonly SyncProcessContainerRecord[],
): readonly ResolvedSyncTarget[] {
  const targets: ResolvedSyncTarget[] = []

  for (const record of records) {
    const provider = toSupportedSyncProvider(record.carrierCode)
    if (!provider) {
      continue
    }

    targets.push({
      processId: record.processId,
      containerNumber: normalizeContainerNumber(record.containerNumber),
      provider,
    })
  }

  return dedupeTargets(targets)
}

function toFirstError(statuses: readonly SyncRequestStatusItem[], fallback: string): string {
  const firstFailure = statuses.find((status) => status.status !== 'DONE')
  if (!firstFailure) return fallback

  return (
    firstFailure.lastError ?? `${firstFailure.status.toLowerCase()}_${firstFailure.syncRequestId}`
  )
}

export function createSyncProcessUseCase(deps: SyncProcessDeps) {
  return async function execute(command: {
    readonly tenantId: string
    readonly scope: { readonly kind: 'process'; readonly processId: string }
    readonly mode: 'manual' | 'live' | 'backfill'
  }): Promise<SyncProcessResult> {
    if (command.scope.kind !== 'process') {
      throw new HttpError('invalid_sync_scope_for_process', 400)
    }

    const processId = command.scope.processId.trim()
    const process = await deps.targetReadPort.fetchProcessById({ processId })
    if (!process) {
      throw new HttpError('process_not_found', 404)
    }

    const containersResult = await deps.targetReadPort.listContainersByProcessId({ processId })
    const records = containersResult.containers.map((container) => ({
      containerId: container.id,
      processId,
      containerNumber: normalizeContainerNumber(container.containerNumber),
      carrierCode: container.carrierCode,
    }))
    const initialTargets = toSyncTargets(records)

    let initialFailures: readonly SyncRequestStatusItem[] = []
    let syncedContainers = 0

    if (initialTargets.length > 0) {
      const terminalStatuses = await executeSyncTargets({
        tenantId: command.tenantId,
        mode: command.mode,
        targets: initialTargets,
        enqueuePolicyService: deps.enqueuePolicyService,
        queuePort: deps.queuePort,
        nowMs: deps.nowMs,
        sleep: deps.sleep,
        timeoutMs: deps.timeoutMs,
        pollIntervalMs: deps.pollIntervalMs,
        timeoutErrorMessage: 'sync_process_timeout',
      })

      syncedContainers += terminalStatuses.filter((status) => status.status === 'DONE').length
      initialFailures = terminalStatuses.filter((status) => status.status !== 'DONE')

      const nonDetectableFailures = initialFailures.filter(
        (status) => !isContainerNotFoundLikeStatus(status),
      )
      if (nonDetectableFailures.length > 0) {
        throw new HttpError(
          `sync_process_failed:${processId}:${toFirstError(nonDetectableFailures, 'sync_failed')}`,
          502,
        )
      }
    }

    const failedContainerNumbers = new Set(
      initialFailures
        .map((status) => status.refValue)
        .filter(
          (refValue): refValue is string => typeof refValue === 'string' && refValue.length > 0,
        )
        .map((refValue) => normalizeContainerNumber(refValue)),
    )

    const retryTargets: ResolvedSyncTarget[] = []

    for (const record of records) {
      const supportedProvider = toSupportedSyncProvider(record.carrierCode)
      const needsDetection =
        supportedProvider === null || failedContainerNumbers.has(record.containerNumber)
      if (!needsDetection) {
        continue
      }

      const detectionResult = await deps.carrierDetectionEngine.detectCarrier({
        tenantId: command.tenantId,
        containerNumber: record.containerNumber,
        excludeProviders: supportedProvider ? [supportedProvider] : [],
      })

      const run = deps.carrierDetectionWritePort.recordDetectionRun
        ? await deps.carrierDetectionWritePort.recordDetectionRun({
            processId,
            containerNumber: record.containerNumber,
            containerId: record.containerId,
            candidateProviders:
              detectionResult.candidateProviders ?? detectionResult.attemptedProviders,
            attempts: toDetectionAttempts(detectionResult),
            status: toDetectionRunStatus(detectionResult),
            resolvedProvider: detectionResult.detected ? detectionResult.provider : null,
            confidence: toDetectionConfidence(detectionResult),
            errorCode: detectionResult.error,
          })
        : { runId: '00000000-0000-0000-0000-000000000000', won: true }

      if (!detectionResult.detected) {
        throw new HttpError(
          `sync_process_failed:${processId}:${detectionResult.error ?? detectionResult.reason}`,
          502,
        )
      }

      if (run.won) {
        await deps.carrierDetectionWritePort.persistDetectedCarrier({
          processId,
          runId: run.runId,
          containerNumber: record.containerNumber,
          carrierCode: toPersistedCarrierCode(detectionResult.provider),
          confidence: toDetectionConfidence(detectionResult),
          detectionSource: 'auto-detect',
        })
      }

      retryTargets.push({
        processId,
        containerNumber: record.containerNumber,
        provider: detectionResult.provider,
      })
    }

    const dedupedRetryTargets = dedupeTargets(retryTargets)
    if (dedupedRetryTargets.length === 0) {
      return {
        processId,
        syncedContainers,
      }
    }

    const retryStatuses = await executeSyncTargets({
      tenantId: command.tenantId,
      mode: command.mode,
      targets: dedupedRetryTargets,
      enqueuePolicyService: deps.enqueuePolicyService,
      queuePort: deps.queuePort,
      nowMs: deps.nowMs,
      sleep: deps.sleep,
      timeoutMs: deps.timeoutMs,
      pollIntervalMs: deps.pollIntervalMs,
      timeoutErrorMessage: 'sync_process_timeout',
    })

    const retryFailures = retryStatuses.filter((status) => status.status !== 'DONE')
    if (retryFailures.length > 0) {
      throw new HttpError(
        `sync_process_failed:${processId}:${toFirstError(retryFailures, 'retry_failed')}`,
        502,
      )
    }

    return {
      processId,
      syncedContainers: syncedContainers + retryStatuses.length,
    }
  }
}
