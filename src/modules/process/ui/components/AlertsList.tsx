import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { AlertIcon } from '~/modules/process/ui/components/Icons'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import { useTranslation } from '~/shared/localization/i18n'

type AlertCategoryChipType = 'delay' | 'customs' | 'missing-eta' | 'transshipment' | 'info'

function toAlertCategoryLabel(
  type: AlertCategoryChipType,
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  switch (type) {
    case 'delay':
    case 'missing-eta':
      return t(keys.shipmentView.alerts.category.eta)
    case 'customs':
      return t(keys.shipmentView.alerts.category.customs)
    case 'transshipment':
      return t(keys.shipmentView.alerts.category.movement)
    default:
      return t(keys.shipmentView.alerts.category.data)
  }
}

function toAlertCategoryIcon(type: AlertCategoryChipType): string {
  switch (type) {
    case 'delay':
    case 'missing-eta':
      return '\u23F1'
    case 'customs':
      return '\uD83D\uDEC3'
    case 'transshipment':
      return '\u21C4'
    default:
      return '\uD83D\uDDC4'
  }
}

function toSeverityBadgeClasses(severity: AlertDisplayVM['severity']): string {
  if (severity === 'danger') return 'border-red-200 bg-red-50 text-red-700'
  if (severity === 'warning') return 'border-yellow-200 bg-yellow-50 text-yellow-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

function formatAlertAge(
  triggeredAtIso: string,
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  const date = new Date(triggeredAtIso)
  if (Number.isNaN(date.getTime())) return ''
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

function toSeverityLabel(
  severity: AlertDisplayVM['severity'],
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (severity === 'danger') return t(keys.shipmentView.alerts.severity.danger)
  if (severity === 'warning') return t(keys.shipmentView.alerts.severity.warning)
  return t(keys.shipmentView.alerts.severity.info)
}

function toAlertCardClasses(severity: AlertDisplayVM['severity'], isFirst: boolean): string {
  if (isFirst) {
    if (severity === 'danger') return 'border-red-200 bg-red-50/80 border-l-red-500 border-l-4'
    if (severity === 'warning')
      return 'border-amber-200 bg-amber-50/80 border-l-amber-400 border-l-4'
    return 'border-slate-200 bg-slate-50/80 border-l-slate-400 border-l-4'
  }
  if (severity === 'danger') return 'border-red-100 bg-red-50/40 border-l-red-400 border-l-2'
  if (severity === 'warning') return 'border-amber-100 bg-amber-50/40 border-l-amber-300 border-l-2'
  return 'border-slate-100 bg-slate-50/40 border-l-slate-300 border-l-2'
}

function AlertCategoryChip(props: {
  type: AlertCategoryChipType
  t: ReturnType<typeof useTranslation>['t']
  keys: ReturnType<typeof useTranslation>['keys']
}): JSX.Element {
  return (
    <span class="inline-flex items-center gap-0.5 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium leading-none text-slate-500">
      <span aria-hidden="true">{toAlertCategoryIcon(props.type)}</span>
      {toAlertCategoryLabel(props.type, props.t, props.keys)}
    </span>
  )
}

export function AlertsList(props: { alerts: readonly AlertDisplayVM[] }): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="gap-1 flex flex-col">
      <For each={props.alerts}>
        {(alert, index) => (
          <li
            class={`flex gap-1.5 rounded border px-2 py-1.5 list-none ${toAlertCardClasses(alert.severity, index() === 0)}`}
          >
            <AlertIcon type={alert.type} />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1 flex-wrap">
                <span
                  class={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold leading-none ${toSeverityBadgeClasses(alert.severity)}`}
                >
                  {toSeverityLabel(alert.severity, t, keys)}
                </span>
                <AlertCategoryChip type={alert.type} t={t} keys={keys} />
                <span class="text-[10px] font-medium tabular-nums text-slate-500">
                  {formatAlertAge(alert.triggeredAtIso, t, keys)}
                </span>
              </div>
              <p class="mt-0.5 text-[11px] leading-tight text-slate-600">{alert.message}</p>
            </div>
          </li>
        )}
      </For>
    </div>
  )
}
