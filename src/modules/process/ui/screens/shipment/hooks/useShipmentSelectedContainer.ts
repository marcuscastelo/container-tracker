import type { Accessor, Resource } from 'solid-js'
import { createEffect, createMemo, createSignal } from 'solid-js'
import type {
  ContainerEtaDetailVM,
  ShipmentDetailVM,
} from '~/modules/process/ui/viewmodels/shipment.vm'

type UseShipmentSelectedContainerCommand = {
  readonly shipment: Resource<ShipmentDetailVM | null | undefined>
}

type ShipmentSelectedContainerResult = {
  readonly selectedContainerId: Accessor<string>
  readonly setSelectedContainerId: (value: string) => void
  readonly selectedContainer: Accessor<ShipmentDetailVM['containers'][number] | null>
  readonly selectedContainerEtaVm: Accessor<ContainerEtaDetailVM>
}

export function useShipmentSelectedContainer(
  command: UseShipmentSelectedContainerCommand,
): ShipmentSelectedContainerResult {
  const [selectedContainerId, setSelectedContainerId] = createSignal<string>('')

  // Ensure a default container is selected when data loads
  createEffect(() => {
    const data = command.shipment()
    if (data && data.containers.length > 0 && !selectedContainerId()) {
      setSelectedContainerId(String(data.containers[0].id))
    }
  })

  const selectedContainer = createMemo(() => {
    const data = command.shipment()
    if (!data) return null
    const containers = data.containers
    if (containers.length === 0) return null

    const selected = selectedContainerId()
    if (selected) {
      return containers.find((c) => String(c.id) === String(selected)) ?? containers[0]
    }
    return containers[0]
  })

  const selectedContainerEtaVm = createMemo<ContainerEtaDetailVM>(() => {
    const selected = selectedContainer()
    if (!selected) return null
    return selected.selectedEtaVm
  })

  return {
    selectedContainerId,
    setSelectedContainerId,
    selectedContainer,
    selectedContainerEtaVm,
  }
}
