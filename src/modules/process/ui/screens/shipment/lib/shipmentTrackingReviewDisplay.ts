import type { TrackingTimeTravelSyncVM } from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'
import type {
  ContainerDetailVM,
  ShipmentDetailVM,
} from '~/modules/process/ui/viewmodels/shipment.vm'

type ShipmentTrackingValidationDisplayMode = 'current' | 'historical'

export type ShipmentTrackingValidationDisplay = {
  readonly mode: ShipmentTrackingValidationDisplayMode
  readonly shipmentTrackingValidation: ShipmentDetailVM['trackingValidation']
  readonly containers: readonly ContainerDetailVM[]
}

function toHistoricalShipmentTrackingValidation(
  sync: TrackingTimeTravelSyncVM,
): ShipmentDetailVM['trackingValidation'] {
  return {
    hasIssues: sync.trackingValidation.hasIssues,
    highestSeverity: sync.trackingValidation.highestSeverity,
    affectedContainerCount: sync.trackingValidation.hasIssues ? 1 : 0,
  }
}

export function resolveShipmentTrackingValidationDisplay(command: {
  readonly shipment: ShipmentDetailVM
  readonly selectedContainerId: string
  readonly selectedSync: TrackingTimeTravelSyncVM | null
}): ShipmentTrackingValidationDisplay {
  const selectedSync = command.selectedSync

  if (selectedSync === null) {
    return {
      mode: 'current',
      shipmentTrackingValidation: command.shipment.trackingValidation,
      containers: command.shipment.containers,
    }
  }

  const hasSelectedContainer = command.shipment.containers.some(
    (container) => container.id === command.selectedContainerId,
  )

  if (!hasSelectedContainer) {
    return {
      mode: 'current',
      shipmentTrackingValidation: command.shipment.trackingValidation,
      containers: command.shipment.containers,
    }
  }

  return {
    mode: 'historical',
    shipmentTrackingValidation: toHistoricalShipmentTrackingValidation(selectedSync),
    containers: command.shipment.containers.map((container) =>
      container.id === command.selectedContainerId
        ? {
            ...container,
            trackingValidation: selectedSync.trackingValidation,
          }
        : container,
    ),
  }
}
