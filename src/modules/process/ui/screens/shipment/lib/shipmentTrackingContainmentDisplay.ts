import type { TrackingTimeTravelSyncVM } from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'

export function resolveShipmentTrackingContainmentDisplay(command: {
  readonly shipment: ShipmentDetailVM
  readonly selectedContainerId: string
  readonly selectedSync: TrackingTimeTravelSyncVM | null
}): ShipmentDetailVM['containers'][number]['trackingContainment'] {
  if (command.selectedSync !== null) {
    return null
  }

  const selectedContainer = command.shipment.containers.find(
    (container) => container.id === command.selectedContainerId,
  )

  return selectedContainer?.trackingContainment ?? null
}
