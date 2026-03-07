import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { AlertsList } from '~/modules/process/ui/components/AlertsList'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import { useTranslation } from '~/shared/localization/i18n'

type Props = {
  activeAlerts: readonly AlertDisplayVM[]
  archivedAlerts: readonly AlertDisplayVM[]
  busyAlertIds: ReadonlySet<string>
  collapsingAlertIds: ReadonlySet<string>
  onAcknowledge: (alertId: string) => void
  onUnacknowledge: (alertId: string) => void
}

export function AlertsPanel(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const hasAnyAlert = () => props.activeAlerts.length > 0 || props.archivedAlerts.length > 0

  return (
    <section id="shipment-alerts" class="space-y-1 scroll-mt-[120px]">
      <Show when={props.activeAlerts.length > 0}>
        <div class="rounded-lg border border-amber-200 border-t-2 border-t-amber-400 bg-amber-50/30 p-1.5 shadow-sm backdrop-blur">
          <div class="flex items-center gap-1.5 mb-0.5">
            <svg
              class="h-4 w-4 text-amber-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v3m0 3h.01m-7.732 4h15.464c1.308 0 2.126-1.417 1.472-2.55L13.732 4.45c-.654-1.133-2.29-1.133-2.944 0L2.806 16.45c-.654 1.133.164 2.55 1.472 2.55z"
              />
            </svg>
            <span class="text-sm-ui font-bold text-slate-800">
              {t(keys.shipmentView.alerts.sectionTitle)}
            </span>
          </div>
          <AlertsList
            alerts={props.activeAlerts}
            mode="active"
            busyAlertIds={props.busyAlertIds}
            collapsingAlertIds={props.collapsingAlertIds}
            onAcknowledge={props.onAcknowledge}
            onUnacknowledge={props.onUnacknowledge}
          />
        </div>
      </Show>

      <Show when={props.archivedAlerts.length > 0}>
        <details class="rounded-lg border border-slate-100 bg-slate-50/50 p-1.5">
          <summary class="cursor-pointer select-none text-micro font-medium uppercase tracking-wider text-slate-400">
            {t(keys.shipmentView.alerts.archived.title, { count: props.archivedAlerts.length })}
          </summary>
          <div class="mt-1">
            <AlertsList
              alerts={props.archivedAlerts}
              mode="archived"
              busyAlertIds={props.busyAlertIds}
              collapsingAlertIds={new Set()}
              onAcknowledge={props.onAcknowledge}
              onUnacknowledge={props.onUnacknowledge}
            />
          </div>
        </details>
      </Show>

      <Show when={!hasAnyAlert()}>
        <div class="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs-ui text-slate-500">
          {t(keys.shipmentView.alerts.activeEmpty)}
        </div>
      </Show>
    </section>
  )
}
