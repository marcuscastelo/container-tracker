import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { StatusBadge } from '~/shared/ui/StatusBadge'

type Props = {
  readonly data: ShipmentDetailVM
  readonly alerts: ShipmentDetailVM['alerts']
}

function formatAge(
  ts: string | Date | null | undefined,
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (!ts) return '—'
  const date = typeof ts === 'string' ? new Date(ts) : ts
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—'
  const diff = Date.now() - date.getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return t(keys.shipmentView.alerts.aging.now)
  const m = Math.floor(s / 60)
  if (m < 60) return t(keys.shipmentView.alerts.aging.minutes, { count: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t(keys.shipmentView.alerts.aging.hours, { count: h })
  const d = Math.floor(h / 24)
  return t(keys.shipmentView.alerts.aging.days, { count: d })
}

function findLatestAlertTimestamp(alerts: ShipmentDetailVM['alerts']): string | null {
  if (alerts.length === 0) return null
  let latest: string | null = null
  for (const alert of alerts) {
    if (!latest || alert.triggeredAtIso > latest) {
      latest = alert.triggeredAtIso
    }
  }
  return latest
}

export function OperationalSummaryStrip(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  const alertCount = () => props.alerts.length
  const latestAlertTs = () => findLatestAlertTimestamp(props.alerts)

  return (
    <section class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-1.5">
      {/* Status */}
      <div class="flex items-center gap-1.5">
        <span class="text-micro font-normal uppercase tracking-wider text-slate-400/70">
          {t(keys.shipmentView.summaryStrip.status)}
        </span>
        <StatusBadge
          variant={props.data.status}
          label={t(trackingStatusToLabelKey(keys, props.data.statusCode))}
        />
      </div>

      {/* Carrier */}
      <div class="flex items-center gap-1.5">
        <span class="text-micro font-normal uppercase tracking-wider text-slate-400/70">
          {t(keys.shipmentView.summaryStrip.carrier)}
        </span>
        <span class="text-label font-semibold uppercase text-slate-700">
          {props.data.carrier ?? t(keys.shipmentView.summaryStrip.unknown)}
        </span>
      </div>

      {/* ETA */}
      <div class="flex items-center gap-1.5">
        <span class="text-micro font-normal uppercase tracking-wider text-slate-400/70">
          {t(keys.shipmentView.summaryStrip.eta)}
        </span>
        <span class="text-label font-bold tabular-nums text-slate-900">
          {props.data.eta ?? t(keys.shipmentView.summaryStrip.unknown)}
        </span>
      </div>

      {/* Containers */}
      <div class="flex items-center gap-1.5">
        <span class="text-micro font-normal uppercase tracking-wider text-slate-400/70">
          {t(keys.shipmentView.summaryStrip.containers)}
        </span>
        <span class="text-label font-bold tabular-nums text-slate-700">
          {props.data.containers.length}
        </span>
      </div>

      {/* Alerts */}
      <div class="flex items-center gap-1.5">
        <span class="text-micro font-normal uppercase tracking-wider text-slate-400/70">
          {t(keys.shipmentView.summaryStrip.alerts)}
        </span>
        <Show
          when={alertCount() > 0}
          fallback={
            <span class="text-label text-slate-400">
              {t(keys.shipmentView.summaryStrip.noAlerts)}
            </span>
          }
        >
          <span class="inline-flex items-center rounded bg-red-50 px-1.5 py-px text-label font-bold tabular-nums text-red-700">
            {alertCount()}
          </span>
        </Show>
      </div>

      {/* Last Update */}
      <div class="flex items-center gap-1.5">
        <span class="text-micro font-normal uppercase tracking-wider text-slate-400/70">
          {t(keys.shipmentView.summaryStrip.lastUpdate)}
        </span>
        <span class="text-label tabular-nums text-slate-500">
          {formatAge(latestAlertTs(), t, keys)}
        </span>
      </div>
    </section>
  )
}
