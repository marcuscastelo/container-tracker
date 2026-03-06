import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { AlertItem } from '~/modules/process/ui/components/AlertsListItem'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'

type AlertsListMode = 'active' | 'archived'

export function AlertsList(props: {
  alerts: readonly AlertDisplayVM[]
  mode: AlertsListMode
  busyAlertIds: ReadonlySet<string>
  collapsingAlertIds: ReadonlySet<string>
  onAcknowledge: (alertId: string) => void
  onUnacknowledge: (alertId: string) => void
}): JSX.Element {
  return (
    <div class="flex flex-col gap-1.5">
      <For each={props.alerts}>
        {(alert) => (
          <AlertItem
            alert={alert}
            mode={props.mode}
            busyAlertIds={props.busyAlertIds}
            collapsingAlertIds={props.collapsingAlertIds}
            onAcknowledge={props.onAcknowledge}
            onUnacknowledge={props.onUnacknowledge}
          />
        )}
      </For>
    </div>
  )
}
