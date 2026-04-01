import type { Accessor } from 'solid-js'
import { createEffect, createSignal } from 'solid-js'
import {
  resolveShipmentAlertNavigationAction,
  scrollShipmentCurrentStatusIntoView,
} from '~/modules/process/ui/screens/shipment/lib/shipmentAlertNavigation'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { readProcessContainerNavigationState } from '~/shared/ui/navigation/app-navigation'

type UseShipmentAlertNavigationCommand = {
  readonly locationState: Accessor<unknown>
  readonly shipment: Accessor<ShipmentDetailVM | null | undefined>
  readonly preferredContainerNumber: Accessor<string | null>
  readonly selectedContainer: Accessor<ShipmentDetailVM['containers'][number] | null>
  readonly isTrackingTimeTravelActive: Accessor<boolean>
  readonly closeTrackingTimeTravel: () => void
}

export function useShipmentAlertNavigation(command: UseShipmentAlertNavigationCommand): void {
  const [handledRequestKey, setHandledRequestKey] = createSignal<string | null>(null)
  let scheduledRequestKey: string | null = null

  createEffect(() => {
    const navigationState = readProcessContainerNavigationState(command.locationState())
    const action = resolveShipmentAlertNavigationAction({
      navigationState,
      handledRequestKey: handledRequestKey(),
      shipment: command.shipment(),
      preferredContainerNumber: command.preferredContainerNumber(),
      selectedContainer: command.selectedContainer(),
      isTrackingTimeTravelActive: command.isTrackingTimeTravelActive(),
    })

    if (action === null || navigationState === null || action === 'wait') return

    if (action === 'close-live-status') {
      command.closeTrackingTimeTravel()
      return
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') return
    if (scheduledRequestKey === navigationState.requestKey) return

    scheduledRequestKey = navigationState.requestKey

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const didScroll = scrollShipmentCurrentStatusIntoView(document)
        scheduledRequestKey = null
        if (!didScroll) return

        setHandledRequestKey(navigationState.requestKey)
      })
    })
  })
}
