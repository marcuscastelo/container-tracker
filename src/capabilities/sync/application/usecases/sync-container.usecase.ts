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

type SyncContainerResult = {
  readonly containerNumber: string
  readonly syncedContainers: number
}

type SyncContainerRecord = {
  readonly containerId?: string | undefined
  readonly processId: string
  readonly containerNumber: string
  readonly carrierCode: string | null
}

export type SyncContainerDeps = {
  readonly targetReadPort: Pick<SyncTargetReadPort, 'findContainersByNumber'>
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

function toSyncTargets(records: readonly SyncContainerRecord[]): readonly ResolvedSyncTarget[] {
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

function assertSingleProvider(
  targets: readonly ResolvedSyncTarget[],
  containerNumber: string,
): void {
  const providers = new Set(targets.map((target) => target.provider))
  if (providers.size > 1) {
    throw new HttpError(
      `ambiguous_sync_provider_for_container:${containerNumber}:${Array.from(providers).join(',')}`,
      409,
    )
  }
}

async function detectCarrierAndRetry(command: {
  readonly tenantId: string
  readonly containerNumber: string
  readonly currentTargets: readonly ResolvedSyncTarget[]
  readonly records: readonly SyncContainerRecord[]
  readonly deps: SyncContainerDeps
}): Promise<readonly SyncRequestStatusItem[]> {
  const excludedProviders = command.currentTargets.map((target) => target.provider)
  const detectionResult = await command.deps.carrierDetectionEngine.detectCarrier({
    tenantId: command.tenantId,
    containerNumber: command.containerNumber,
    excludeProviders: excludedProviders,
  })

  if (!detectionResult.detected) {
    for (const record of command.records) {
      if (command.deps.carrierDetectionWritePort.recordDetectionRun) {
        await command.deps.carrierDetectionWritePort.recordDetectionRun({
          processId: record.processId,
          containerNumber: command.containerNumber,
          containerId: record.containerId,
          candidateProviders:
            detectionResult.candidateProviders ?? detectionResult.attemptedProviders,
          attempts: toDetectionAttempts(detectionResult),
          status: toDetectionRunStatus(detectionResult),
          resolvedProvider: null,
          confidence: toDetectionConfidence(detectionResult),
          errorCode: detectionResult.error,
        })
      }
    }

    throw new HttpError(
      `sync_container_failed:${detectionResult.error ?? detectionResult.reason}`,
      502,
    )
  }

  const persistedCarrierCode = toPersistedCarrierCode(detectionResult.provider)
  for (const record of command.records) {
    const run = command.deps.carrierDetectionWritePort.recordDetectionRun
      ? await command.deps.carrierDetectionWritePort.recordDetectionRun({
          processId: record.processId,
          containerNumber: command.containerNumber,
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

    if (run.won) {
      await command.deps.carrierDetectionWritePort.persistDetectedCarrier({
        processId: record.processId,
        runId: run.runId,
        containerNumber: command.containerNumber,
        carrierCode: persistedCarrierCode,
        confidence: toDetectionConfidence(detectionResult),
        detectionSource: 'auto-detect',
      })
    }
  }

  const primaryRecord = command.records[0]
  if (primaryRecord === undefined) {
    throw new HttpError('container_not_found', 404)
  }

  return executeSyncTargets({
    tenantId: command.tenantId,
    mode: 'manual',
    targets: [
      {
        processId: primaryRecord.processId,
        containerNumber: command.containerNumber,
        provider: detectionResult.provider,
      },
    ],
    enqueuePolicyService: command.deps.enqueuePolicyService,
    queuePort: command.deps.queuePort,
    nowMs: command.deps.nowMs,
    sleep: command.deps.sleep,
    timeoutMs: command.deps.timeoutMs,
    pollIntervalMs: command.deps.pollIntervalMs,
    timeoutErrorMessage: 'sync_container_timeout',
  })
}

export function createSyncContainerUseCase(deps: SyncContainerDeps) {
  return async function execute(command: {
    readonly tenantId: string
    readonly scope: { readonly kind: 'container'; readonly containerNumber: string }
    readonly mode: 'manual' | 'live' | 'backfill'
  }): Promise<SyncContainerResult> {
    if (command.scope.kind !== 'container') {
      throw new HttpError('invalid_sync_scope_for_container', 400)
    }

    const containerNumber = normalizeContainerNumber(command.scope.containerNumber)
    const lookupResult = await deps.targetReadPort.findContainersByNumber({ containerNumber })
    const records = lookupResult.containers.map((record) => ({
      containerId: record.id,
      processId: record.processId,
      containerNumber: normalizeContainerNumber(record.containerNumber),
      carrierCode: record.carrierCode,
    }))

    if (records.length === 0) {
      throw new HttpError('container_not_found', 404)
    }

    const targets = toSyncTargets(records)
    assertSingleProvider(targets, containerNumber)

    let terminalStatuses: readonly SyncRequestStatusItem[] = []

    if (targets.length > 0) {
      terminalStatuses = await executeSyncTargets({
        tenantId: command.tenantId,
        mode: command.mode,
        targets,
        enqueuePolicyService: deps.enqueuePolicyService,
        queuePort: deps.queuePort,
        nowMs: deps.nowMs,
        sleep: deps.sleep,
        timeoutMs: deps.timeoutMs,
        pollIntervalMs: deps.pollIntervalMs,
        timeoutErrorMessage: 'sync_container_timeout',
      })
    }

    const failures = terminalStatuses.filter((status) => status.status !== 'DONE')
    if (targets.length === 0 || failures.some((status) => isContainerNotFoundLikeStatus(status))) {
      const retryStatuses = await detectCarrierAndRetry({
        tenantId: command.tenantId,
        containerNumber,
        currentTargets: targets,
        records,
        deps,
      })

      const retryFailures = retryStatuses.filter((status) => status.status !== 'DONE')
      if (retryFailures.length > 0) {
        throw new HttpError(
          `sync_container_failed:${toFirstError(retryFailures, 'retry_failed')}`,
          502,
        )
      }

      return {
        containerNumber,
        syncedContainers: 1,
      }
    }

    if (failures.length > 0) {
      throw new HttpError(`sync_container_failed:${toFirstError(failures, 'sync_failed')}`, 502)
    }

    return {
      containerNumber,
      syncedContainers: targets.length,
    }
  }
}
