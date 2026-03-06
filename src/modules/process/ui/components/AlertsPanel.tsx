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
        <div class="rounded-lg border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur">
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
        <details class="rounded-lg border border-slate-200 bg-slate-50/80 p-1.5">
          <summary class="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
        <div class="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-500">
          {t(keys.shipmentView.alerts.activeEmpty)}
        </div>
      </Show>
    </section>
  )
}
