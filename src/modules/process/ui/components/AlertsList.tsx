import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { AlertIcon } from '~/modules/process/ui/components/Icons'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import { useTranslation } from '~/shared/localization/i18n'

type AlertCategoryChipType = 'delay' | 'customs' | 'missing-eta' | 'transshipment' | 'info'
type AlertsListMode = 'active' | 'archived'

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

function toSeverityBadgeClasses(
  severity: AlertDisplayVM['severity'],
  mode: AlertsListMode,
): string {
  if (mode === 'archived') {
    return 'border-slate-200 bg-slate-100 text-slate-500'
  }
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

function toAlertCardClasses(severity: AlertDisplayVM['severity'], mode: AlertsListMode): string {
  if (mode === 'archived') return 'border-slate-200 bg-slate-100/80 border-l-slate-300 border-l-2'
  if (severity === 'danger') return 'border-red-200 bg-red-50/85 border-l-red-500 border-l-4'
  if (severity === 'warning') return 'border-amber-200 bg-amber-50/85 border-l-amber-400 border-l-4'
  return 'border-blue-100 bg-blue-50/70 border-l-blue-300 border-l-4'
}

function AlertCategoryChip(props: {
  type: AlertCategoryChipType
  mode: AlertsListMode
  t: ReturnType<typeof useTranslation>['t']
  keys: ReturnType<typeof useTranslation>['keys']
}): JSX.Element {
  return (
    <span
      class={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-xs font-normal leading-none ${
        props.mode === 'archived' ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-400'
      }`}
    >
      <span aria-hidden="true">{toAlertCategoryIcon(props.type)}</span>
      {toAlertCategoryLabel(props.type, props.t, props.keys)}
    </span>
  )
}

export function AlertsList(props: {
  alerts: readonly AlertDisplayVM[]
  mode: AlertsListMode
  busyAlertIds: ReadonlySet<string>
  collapsingAlertIds: ReadonlySet<string>
  onAcknowledge: (alertId: string) => void
  onUnacknowledge: (alertId: string) => void
}): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="flex flex-col gap-1.5">
      <For each={props.alerts}>
        {(alert) => {
          const isBusy = () => props.busyAlertIds.has(alert.id)
          const isCollapsing = () => props.collapsingAlertIds.has(alert.id)
          const actionDateIso = () => alert.ackedAtIso ?? alert.triggeredAtIso
          return (
            <li
              class={`list-none rounded border px-2 py-1.5 transition-all duration-200 ease-out overflow-hidden ${toAlertCardClasses(
                alert.severity,
                props.mode,
              )} ${
                isCollapsing()
                  ? 'max-h-0 translate-y-[-4px] border-transparent py-0 opacity-0'
                  : 'max-h-40 opacity-100'
              } flex items-start gap-1.5`}
            >
              <AlertIcon type={alert.type} />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1 flex-wrap">
                  <span
                    class={`inline-flex items-center rounded border px-1.5 py-0.5 text-micro font-bold leading-none ${toSeverityBadgeClasses(alert.severity, props.mode)}`}
                  >
                    {toSeverityLabel(alert.severity, t, keys)}
                  </span>
                  <AlertCategoryChip type={alert.type} mode={props.mode} t={t} keys={keys} />
                  <span class="text-micro font-medium tabular-nums text-slate-500">
                    {formatAlertAge(actionDateIso(), t, keys)}
                  </span>
                </div>
                <p class="mt-0.5 text-label font-medium leading-tight text-slate-700">{alert.message}</p>
              </div>
              <Show
                when={props.mode === 'active'}
                fallback={
                  <button
                    type="button"
                    disabled={isBusy()}
                    class="inline-flex h-6 items-center justify-center rounded border border-slate-300 bg-white px-2 text-micro font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={t(keys.shipmentView.alerts.action.unacknowledgeAria)}
                    onClick={() => props.onUnacknowledge(alert.id)}
                  >
                    {t(keys.shipmentView.alerts.action.unacknowledge)}
                  </button>
                }
              >
                <button
                  type="button"
                  disabled={isBusy()}
                  class="inline-flex h-6 w-6 items-center justify-center rounded border border-transparent text-slate-400 transition hover:border-emerald-200 hover:text-emerald-600 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={t(keys.shipmentView.alerts.action.acknowledgeAria)}
                  title={t(keys.shipmentView.alerts.action.acknowledge)}
                  onClick={() => props.onAcknowledge(alert.id)}
                >
                  <svg
                    class="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2.5"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </button>
              </Show>
            </li>
          )
        }}
      </For>
    </div>
  )
}
