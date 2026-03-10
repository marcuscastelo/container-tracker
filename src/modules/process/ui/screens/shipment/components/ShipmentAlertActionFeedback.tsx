import type { Accessor } from 'solid-js'
import { Show } from 'solid-js'
import { AlertActionBanner } from '~/modules/process/ui/components/AlertActionBanner'

type ShipmentAlertActionFeedbackProps = {
  readonly alertActionError: Accessor<string | null>
  readonly onDismissAlertActionError: () => void
}

export function ShipmentAlertActionFeedback(props: ShipmentAlertActionFeedbackProps) {
  return (
    <Show when={props.alertActionError()}>
      <AlertActionBanner
        message={props.alertActionError() ?? ''}
        onDismiss={props.onDismissAlertActionError}
      />
    </Show>
  )
}
