import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { AlertIcon } from '~/modules/process/ui/components/Icons'
import { resolveLifecycleState } from '~/modules/process/ui/screens/shipment/lib/alert-lifecycle'
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
    return 'border-border bg-surface-muted text-text-muted'
  }
  if (severity === 'danger')
    return 'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg'
  if (severity === 'warning')
    return 'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg'
  return 'border-tone-info-border bg-tone-info-bg text-tone-info-fg'
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
  if (mode === 'archived')
    return 'border-border bg-surface-muted/80 border-l-border-strong border-l-2'
  if (severity === 'danger')
    return 'border-tone-danger-border bg-tone-danger-bg/85 border-l-tone-danger-strong border-l-4'
  if (severity === 'warning')
    return 'border-tone-warning-border bg-tone-warning-bg/85 border-l-tone-warning-strong border-l-4'
  return 'border-tone-info-border bg-tone-info-bg/75 border-l-tone-info-strong border-l-4'
}

function AlertCategoryChip(props: {
  type: AlertCategoryChipType
  mode: AlertsListMode
  t: ReturnType<typeof useTranslation>['t']
  keys: ReturnType<typeof useTranslation>['keys']
}): JSX.Element {
  const bg = () => (props.mode === 'archived' ? 'bg-surface-muted' : 'bg-secondary')
  const textColor = 'text-text-muted'

  return (
    <span
      class={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-xs-ui font-normal leading-none ${bg()} ${textColor}`}
    >
      <span aria-hidden="true">{toAlertCategoryIcon(props.type)}</span>
      {toAlertCategoryLabel(props.type, props.t, props.keys)}
    </span>
  )
}

export function AlertItem(props: {
  alert: AlertDisplayVM
  mode: AlertsListMode
  busyAlertIds: ReadonlySet<string>
  collapsingAlertIds: ReadonlySet<string>
  onAcknowledge: (alertId: string) => void
  onUnacknowledge: (alertId: string) => void
}): JSX.Element {
  const { t, keys } = useTranslation()
  const isBusy = () => props.busyAlertIds.has(props.alert.id)
  const isCollapsing = () => props.collapsingAlertIds.has(props.alert.id)
  const lifecycleState = () => resolveLifecycleState(props.alert)
  const actionDateIso = () =>
    props.alert.ackedAtIso ?? props.alert.resolvedAtIso ?? props.alert.triggeredAtIso
  const translatedMessage = () => t(props.alert.messageKey, props.alert.messageParams)

  return (
    <li
      data-testid={`alert-item-${props.alert.id}`}
      class={`list-none rounded border px-2 py-1.5 transition-all duration-200 ease-out overflow-hidden hover:shadow-sm ${toAlertCardClasses(
        props.alert.severity,
        props.mode,
      )} ${
        isCollapsing()
          ? 'max-h-0 -translate-y-1 border-transparent py-0 opacity-0'
          : 'max-h-40 opacity-100'
      } flex items-start gap-1.5`}
    >
      <AlertIcon type={props.alert.type} />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1 flex-wrap">
          <span
            class={`inline-flex items-center rounded border px-1.5 py-0.5 text-micro font-bold leading-none ${toSeverityBadgeClasses(
              props.alert.severity,
              props.mode,
            )}`}
          >
            {toSeverityLabel(props.alert.severity, t, keys)}
          </span>
          <AlertCategoryChip type={props.alert.type} mode={props.mode} t={t} keys={keys} />
          <span class="text-micro font-medium tabular-nums text-text-muted">
            {formatAlertAge(actionDateIso(), t, keys)}
          </span>
        </div>
        <p class="mt-0.5 text-sm-ui font-medium leading-tight text-foreground">
          {translatedMessage()}
        </p>
        <p class="mt-0.5 text-xs-ui text-text-muted">
          {t(keys.alerts.containerLabel)}:{' '}
          <span class="font-semibold text-foreground">{props.alert.containerNumber}</span>
        </p>
      </div>
      <Show when={props.mode === 'active'}>
        <button
          type="button"
          disabled={isBusy()}
          data-testid={`alert-ack-button-${props.alert.id}`}
          class="inline-flex h-6 w-6 items-center justify-center rounded border border-transparent text-text-muted transition hover:border-tone-success-border hover:bg-tone-success-bg hover:text-tone-success-fg disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={t(keys.shipmentView.alerts.action.acknowledgeAria)}
          title={t(keys.shipmentView.alerts.action.acknowledge)}
          onClick={() => props.onAcknowledge(props.alert.id)}
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
      <Show
        when={props.mode === 'archived' && lifecycleState() === 'ACKED'}
        fallback={<span class="inline-flex h-6 w-6" aria-hidden="true" />}
      >
        <button
          type="button"
          disabled={isBusy()}
          data-testid={`alert-unack-button-${props.alert.id}`}
          class="inline-flex h-6 items-center justify-center rounded border border-border bg-surface px-2 text-micro font-semibold uppercase tracking-wide text-text-muted transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={t(keys.shipmentView.alerts.action.unacknowledgeAria)}
          onClick={() => props.onUnacknowledge(props.alert.id)}
        >
          {t(keys.shipmentView.alerts.action.unacknowledge)}
        </button>
      </Show>
    </li>
  )
}
