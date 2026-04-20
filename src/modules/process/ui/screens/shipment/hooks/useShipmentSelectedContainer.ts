import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal } from 'solid-js'
import { findContainerIdByNumber } from '~/modules/process/ui/screens/shipment/lib/shipmentContainerSelection'
import type {
  ContainerEtaDetailVM,
  ShipmentDetailVM,
} from '~/modules/process/ui/viewmodels/shipment.vm'

type UseShipmentSelectedContainerCommand = {
  readonly shipment: Accessor<ShipmentDetailVM | null | undefined>
  readonly preferredContainerNumber: Accessor<string | null>
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
  const [appliedPreferredSelectionKey, setAppliedPreferredSelectionKey] = createSignal<
    string | null
  >(null)

  // Ensure a default container is selected when data loads
  createEffect(() => {
    const data = command.shipment()
    const firstContainer = data?.containers[0]
    if (data && firstContainer && !selectedContainerId()) {
      setSelectedContainerId(String(firstContainer.id))
    }
  })

  createEffect(() => {
    const preferredContainerNumber = command.preferredContainerNumber()
    const data = command.shipment()
    if (!data || data.containers.length === 0) return

    if (preferredContainerNumber === null) {
      setAppliedPreferredSelectionKey(null)
      return
    }

    const normalizedSelectionKey = `${data.id}::${preferredContainerNumber}`
    if (appliedPreferredSelectionKey() === normalizedSelectionKey) return

    const matchedContainerId = findContainerIdByNumber(
      data.containers.map((container) => ({
        id: String(container.id),
        number: container.number,
      })),
      preferredContainerNumber,
    )

    setAppliedPreferredSelectionKey(normalizedSelectionKey)
    if (matchedContainerId === null) return
    setSelectedContainerId(matchedContainerId)
  })

  const selectedContainer = createMemo(() => {
    const data = command.shipment()
    if (!data) return null
    const containers = data.containers
    if (containers.length === 0) return null
    const firstContainer = containers[0]
    if (!firstContainer) return null

    const selected = selectedContainerId()
    if (selected) {
      return containers.find((c) => String(c.id) === String(selected)) ?? firstContainer
    }
    return firstContainer
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
