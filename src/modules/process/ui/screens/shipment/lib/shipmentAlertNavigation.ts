import { findContainerIdByNumber } from '~/modules/process/ui/screens/shipment/lib/shipmentContainerSelection'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import type { ProcessContainerNavigationState } from '~/shared/ui/navigation/app-navigation'

export const SHIPMENT_CURRENT_STATUS_SECTION_ID = 'shipment-current-status'

export type ShipmentAlertNavigationAction = 'close-live-status' | 'scroll-current-status' | 'wait'

type ResolveShipmentAlertNavigationActionCommand = {
  readonly navigationState: ProcessContainerNavigationState | null
  readonly handledRequestKey: string | null
  readonly shipment: ShipmentDetailVM | null | undefined
  readonly preferredContainerNumber: string | null
  readonly selectedContainer: ShipmentDetailVM['containers'][number] | null
  readonly isTrackingTimeTravelActive: boolean
}

function hasMatchingPreferredContainer(
  shipment: ShipmentDetailVM,
  preferredContainerNumber: string | null,
): boolean {
  return (
    findContainerIdByNumber(
      shipment.containers.map((container) => ({
        id: String(container.id),
        number: container.number,
      })),
      preferredContainerNumber,
    ) !== null
  )
}

export function resolveShipmentAlertNavigationAction(
  command: ResolveShipmentAlertNavigationActionCommand,
): ShipmentAlertNavigationAction | null {
  const navigationState = command.navigationState
  if (navigationState === null) return null
  if (command.handledRequestKey === navigationState.requestKey) return null
  if (!command.shipment || !command.selectedContainer) return 'wait'

  if (command.isTrackingTimeTravelActive && navigationState.revealLiveStatus) {
    return 'close-live-status'
  }

  const shouldWaitForPreferredSelection = hasMatchingPreferredContainer(
    command.shipment,
    command.preferredContainerNumber,
  )

  if (
    shouldWaitForPreferredSelection &&
    findContainerIdByNumber(
      [
        {
          id: String(command.selectedContainer.id),
          number: command.selectedContainer.number,
        },
      ],
      command.preferredContainerNumber,
    ) === null
  ) {
    return 'wait'
  }

  return 'scroll-current-status'
}

type ScrollShipmentCurrentStatusIntoViewCommand = {
  readonly getElementById: (
    id: string,
  ) => { scrollIntoView: (options?: ScrollIntoViewOptions) => void } | null
}

export function scrollShipmentCurrentStatusIntoView(
  command: ScrollShipmentCurrentStatusIntoViewCommand,
): boolean {
  const section = command.getElementById(SHIPMENT_CURRENT_STATUS_SECTION_ID)
  if (section === null) return false

  section.scrollIntoView({
    behavior: 'auto',
    block: 'start',
  })
  return true
}
