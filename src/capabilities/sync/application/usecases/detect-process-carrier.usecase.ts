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
}

export type DetectProcessCarrierDeps = {
  readonly targetReadPort: Pick<
    SyncTargetReadPort,
    'fetchProcessById' | 'listContainersByProcessId'
  >
  readonly carrierDetectionEngine: CarrierDetectionEngine
  readonly carrierDetectionWritePort: CarrierDetectionWritePort
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

      if (!detectionResult.detected) {
        continue
      }

      await deps.carrierDetectionWritePort.persistDetectedCarrier({
        processId,
        containerNumber: normalizeContainerNumber(container.containerNumber),
        carrierCode: toPersistedCarrierCode(detectionResult.provider),
      })

      return {
        detected: true,
        carrier: toDisplayCarrierCode(detectionResult.provider),
      }
    }

    return {
      detected: false,
      carrier: null,
    }
  }
}
