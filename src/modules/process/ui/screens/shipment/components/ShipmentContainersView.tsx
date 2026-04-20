import type { Accessor } from 'solid-js'
import { Show } from 'solid-js'
import { ShipmentDataView } from '~/modules/process/ui/components/ShipmentDataView'
import type { TrackingTimeTravelControllerResult } from '~/modules/process/ui/screens/shipment/hooks/useTrackingTimeTravelController'
import type { RefreshRetryState } from '~/modules/process/ui/screens/shipment/types/shipmentScreen.types'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type { AlertIncidentsVM } from '~/modules/process/ui/viewmodels/alert-incident.vm'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import type { Instant } from '~/shared/time/instant'

type ShipmentContainersViewProps = {
  readonly shipmentData: Accessor<ShipmentDetailVM | null | undefined>
  readonly activeAlerts: Accessor<readonly AlertDisplayVM[]>
  readonly alertIncidents: Accessor<AlertIncidentsVM>
  readonly busyAlertIds: Accessor<ReadonlySet<string>>
  readonly recentlyChangedAlertIds: Accessor<ReadonlySet<string>>
  readonly onAcknowledgeAlert: (alertIds: readonly string[]) => void
  readonly onUnacknowledgeAlert: (alertIds: readonly string[]) => void
  readonly isRefreshing: Accessor<boolean>
  readonly refreshRetry: Accessor<RefreshRetryState | null>
  readonly refreshHint: Accessor<string | null>
  readonly syncNow: Accessor<Instant>
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
          alertIncidents={props.alertIncidents()}
          busyAlertIds={props.busyAlertIds()}
          recentlyChangedAlertIds={props.recentlyChangedAlertIds()}
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
