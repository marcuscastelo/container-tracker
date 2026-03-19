import type { Accessor, Resource } from 'solid-js'
import { Show } from 'solid-js'
import { ShipmentDataView } from '~/modules/process/ui/components/ShipmentDataView'
import type { TrackingTimeTravelControllerResult } from '~/modules/process/ui/screens/shipment/hooks/useTrackingTimeTravelController'
import type { RefreshRetryState } from '~/modules/process/ui/screens/shipment/types/shipmentScreen.types'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'

type ShipmentContainersViewProps = {
  readonly shipmentData: Resource<ShipmentDetailVM | null | undefined>
  readonly activeAlerts: Accessor<readonly AlertDisplayVM[]>
  readonly archivedAlerts: Accessor<readonly AlertDisplayVM[]>
  readonly busyAlertIds: Accessor<ReadonlySet<string>>
  readonly collapsingAlertIds: Accessor<ReadonlySet<string>>
  readonly onAcknowledgeAlert: (alertId: string) => void
  readonly onUnacknowledgeAlert: (alertId: string) => void
  readonly isRefreshing: Accessor<boolean>
  readonly refreshRetry: Accessor<RefreshRetryState | null>
  readonly refreshHint: Accessor<string | null>
  readonly syncNow: Accessor<Date>
  readonly onTriggerRefresh: () => void
  readonly selectedContainerId: Accessor<string>
  readonly onSelectContainer: (id: string) => void
  readonly selectedContainer: Accessor<ShipmentDetailVM['containers'][number] | null>
  readonly trackingTimeTravel: TrackingTimeTravelControllerResult
  readonly onOpenEditForShipment: (
    shipment: ShipmentDetailVM,
    focus?: 'reference' | 'carrier' | null | undefined,
  ) => void
}

export function ShipmentContainersView(props: ShipmentContainersViewProps) {
  return (
    <Show when={props.shipmentData()}>
      {(data) => (
        <ShipmentDataView
          data={data()}
          activeAlerts={props.activeAlerts()}
          archivedAlerts={props.archivedAlerts()}
          busyAlertIds={props.busyAlertIds()}
          collapsingAlertIds={props.collapsingAlertIds()}
          onAcknowledgeAlert={props.onAcknowledgeAlert}
          onUnacknowledgeAlert={props.onUnacknowledgeAlert}
          isRefreshing={props.isRefreshing()}
          refreshRetry={props.refreshRetry()}
          refreshHint={props.refreshHint()}
          syncNow={props.syncNow()}
          onTriggerRefresh={props.onTriggerRefresh}
          onOpenEdit={(focus?: 'reference' | 'carrier' | null | undefined) =>
            props.onOpenEditForShipment(data(), focus)
          }
          selectedContainerId={props.selectedContainerId()}
          onSelectContainer={props.onSelectContainer}
          selectedContainer={props.selectedContainer()}
          trackingTimeTravel={props.trackingTimeTravel}
        />
      )}
    </Show>
  )
}
