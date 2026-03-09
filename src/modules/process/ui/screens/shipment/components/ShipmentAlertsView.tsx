import type { Accessor } from 'solid-js'
import { Show } from 'solid-js'
import { AlertActionBanner } from '~/modules/process/ui/components/AlertActionBanner'

type ShipmentAlertsViewProps = {
  readonly alertActionError: Accessor<string | null>
  readonly onDismissAlertActionError: () => void
}

export function ShipmentAlertsView(props: ShipmentAlertsViewProps) {
  return (
    <Show when={props.alertActionError()}>
      <AlertActionBanner
        message={props.alertActionError() ?? ''}
        onDismiss={props.onDismissAlertActionError}
      />
    </Show>
  )
}
