import { bootstrapSyncControllers } from '~/capabilities/sync/interface/http/sync.controllers.bootstrap'
import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import {
  createRefreshProcessDeps,
  createSyncQueuePort,
  createSyncStatusReadPort,
  createSyncTargetReadPort,
  resolveDefaultTenantId,
} from '~/shared/api/sync.bootstrap/sync.bootstrap.ports'

const defaultTenantId = resolveDefaultTenantId()

const targetReadPort = createSyncTargetReadPort({
  processUseCases,
  containerUseCases,
})

const queuePort = createSyncQueuePort({
  defaultTenantId,
})

const statusReadPort = createSyncStatusReadPort({
  targetReadPort,
  defaultTenantId,
})

const refreshProcessDeps = createRefreshProcessDeps({
  targetReadPort,
  queuePort,
  defaultTenantId,
})

const carrierDetectionWritePort = {
  async persistDetectedCarrier(command: {
    readonly processId: string | null
    readonly containerNumber: string
    readonly carrierCode: string
  }) {
    const containersResult = await containerUseCases.findByNumbers({
      containerNumbers: [command.containerNumber],
    })
    const matchingContainers = containersResult.containers.filter((container) => {
      if (!command.processId) {
        return true
      }

      return String(container.processId) === command.processId
    })

    if (command.processId === null && matchingContainers.length > 1) {
      throw new Error(
        `multiple_processes_found_for_container:${command.containerNumber}:process_id_required`,
      )
    }

    for (const container of matchingContainers) {
      await containerUseCases.updateCarrier({
        containerId: String(container.id),
        carrierCode: command.carrierCode,
      })
    }

    if (command.processId) {
      await processUseCases.updateCarrier({
        processId: command.processId,
        carrier: command.carrierCode,
      })
    }
  },
}

const bootstrappedSyncControllers = bootstrapSyncControllers({
  targetReadPort,
  queuePort,
  statusReadPort,
  refreshProcessDeps,
  carrierDetectionWritePort,
  defaultTenantId,
})

export const syncControllers = bootstrappedSyncControllers.syncControllers
export const syncStatusControllers = bootstrappedSyncControllers.syncStatusControllers
