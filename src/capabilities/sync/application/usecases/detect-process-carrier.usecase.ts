import type { CarrierDetectionWritePort } from '~/capabilities/sync/application/ports/carrier-detection-write.port'
import type { SyncTargetReadPort } from '~/capabilities/sync/application/ports/sync-target-read.port'
import type { CarrierDetectionEngine } from '~/capabilities/sync/carrier-detection/carrier-detection.engine'
import {
  normalizeContainerNumber,
  toDisplayCarrierCode,
  toPersistedCarrierCode,
  toSupportedSyncProvider,
} from '~/capabilities/sync/carrier-detection/carrier-detection.providers'
import { HttpError } from '~/shared/errors/httpErrors'

export type DetectProcessCarrierCommand = {
  readonly tenantId: string
  readonly processId: string
  readonly containerNumber?: string
}

export type DetectProcessCarrierResult = {
  readonly detected: boolean
  readonly carrier: string | null
  readonly runId?: string | null
  readonly status?: 'RESOLVED' | 'FAILED' | 'RATE_LIMITED' | null
  readonly resolvedProvider?: string | null
  readonly confidence?: 'HIGH' | 'LOW' | 'UNKNOWN' | null
  readonly attempts?: readonly {
    readonly provider: string
    readonly status: 'FOUND' | 'NOT_FOUND' | 'ERROR'
    readonly errorCode: string | null
  }[]
}

export type DetectProcessCarrierDeps = {
  readonly targetReadPort: Pick<
    SyncTargetReadPort,
    'fetchProcessById' | 'listContainersByProcessId'
  >
  readonly carrierDetectionEngine: CarrierDetectionEngine
  readonly carrierDetectionWritePort: CarrierDetectionWritePort
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

export function createDetectProcessCarrierUseCase(deps: DetectProcessCarrierDeps) {
  return async function execute(
    command: DetectProcessCarrierCommand,
  ): Promise<DetectProcessCarrierResult> {
    const processId = command.processId.trim()
    if (processId.length === 0) {
      throw new HttpError('process_id_required_for_detect_carrier', 400)
    }

    const process = await deps.targetReadPort.fetchProcessById({ processId })
    if (!process) {
      throw new HttpError('process_not_found', 404)
    }

    const normalizedContainerNumber = command.containerNumber
      ? normalizeContainerNumber(command.containerNumber)
      : null
    const containersResult = await deps.targetReadPort.listContainersByProcessId({ processId })
    const containers = containersResult.containers.filter((container) => {
      if (!normalizedContainerNumber) {
        return true
      }

      return normalizeContainerNumber(container.containerNumber) === normalizedContainerNumber
    })

    if (containers.length === 0) {
      throw new HttpError('container_not_found_in_process', 404)
    }

    for (const container of containers) {
      const currentProvider = toSupportedSyncProvider(container.carrierCode)
      const detectionResult = await deps.carrierDetectionEngine.detectCarrier({
        tenantId: command.tenantId,
        containerNumber: container.containerNumber,
        excludeProviders: currentProvider ? [currentProvider] : [],
      })

      const run = deps.carrierDetectionWritePort.recordDetectionRun
        ? await deps.carrierDetectionWritePort.recordDetectionRun({
            processId,
            containerNumber: normalizeContainerNumber(container.containerNumber),
            containerId: container.id,
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
        continue
      }

      if (run.won) {
        await deps.carrierDetectionWritePort.persistDetectedCarrier({
          processId,
          runId: run.runId,
          containerNumber: normalizeContainerNumber(container.containerNumber),
          carrierCode: toPersistedCarrierCode(detectionResult.provider),
          confidence: toDetectionConfidence(detectionResult),
          detectionSource: 'auto-detect',
        })
      }

      return {
        detected: true,
        carrier: toDisplayCarrierCode(detectionResult.provider),
        runId: run.runId,
        status: toDetectionRunStatus(detectionResult),
        resolvedProvider: detectionResult.provider,
        confidence: toDetectionConfidence(detectionResult),
        attempts: toDetectionAttempts(detectionResult).map((attempt) => ({
          provider: attempt.provider,
          status: attempt.status,
          errorCode: attempt.errorCode,
        })),
      }
    }

    return {
      detected: false,
      carrier: null,
      runId: null,
      status: null,
      resolvedProvider: null,
      confidence: null,
      attempts: [],
    }
  }
}
