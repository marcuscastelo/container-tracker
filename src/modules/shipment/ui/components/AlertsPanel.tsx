import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { AlertDisplay } from '~/modules/shipment/application/processPresenter'
import { AlertsList } from '~/modules/shipment/ui/components/AlertsList'

type Props = {
  alerts: readonly AlertDisplay[]
  t: (k: string) => string
  keys: Record<string, string>
}

export function AlertsPanel(props: Props): JSX.Element {
  return (
    <section class="rounded-lg border border-slate-200 bg-white">
      <header class="border-b border-slate-200 px-6 py-4">
        <h2 class="text-base font-semibold text-slate-900">{props.t(props.keys.alertsTitle)}</h2>
      </header>
      <div class="p-4">
        <Show
          when={props.alerts.length > 0}
          fallback={
            <p class="py-4 text-center text-sm text-slate-500">{props.t(props.keys.alertsEmpty)}</p>
          }
        >
          <ul class="space-y-3">
            <AlertsList alerts={props.alerts} />
          </ul>
        </Show>
      </div>
    </section>
  )
}
