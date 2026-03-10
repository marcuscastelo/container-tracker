import type { Accessor } from 'solid-js'
import { Show } from 'solid-js'
import { RefreshErrorBanner } from '~/modules/process/ui/components/RefreshErrorBanner'

type ShipmentRefreshStatusViewProps = {
  readonly refreshError: Accessor<string | null>
  readonly onDismissRefreshError: () => void
}

export function ShipmentRefreshStatusView(props: ShipmentRefreshStatusViewProps) {
  return (
    <Show when={props.refreshError()}>
      <RefreshErrorBanner
        message={props.refreshError() ?? ''}
        onDismiss={props.onDismissRefreshError}
      />
    </Show>
  )
}
