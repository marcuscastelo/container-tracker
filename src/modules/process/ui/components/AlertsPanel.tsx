import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { AlertsList } from '~/modules/process/ui/components/AlertsList'
import type { AlertDisplay } from '~/modules/tracking/application/projection/tracking.alert.presenter'
import { useTranslation } from '~/shared/localization/i18n'

type Props = {
  alerts: readonly AlertDisplay[]
}

export function AlertsPanel(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  return (
    <section class="rounded-lg border border-slate-200 bg-white">
      <header class="border-b border-slate-200 px-6 py-4">
        <h2 class="text-base font-semibold text-slate-900">{t(keys.shipmentView.alerts.title)}</h2>
      </header>
      <div class="p-4">
        <Show
          when={props.alerts.length > 0}
          fallback={
            <p class="py-4 text-center text-sm text-slate-500">
              {t(keys.shipmentView.alerts.empty)}
            </p>
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
