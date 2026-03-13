import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { NavbarAlertVM } from '~/shared/ui/navbar-alerts/navbar-alerts.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type AlertItemProps = {
  readonly alert: NavbarAlertVM
  readonly onOpenContainer: () => void
}

function toSeverityClasses(severity: NavbarAlertVM['severity']): string {
  if (severity === 'danger') {
    return 'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg'
  }
  if (severity === 'warning') {
    return 'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg'
  }
  return 'border-tone-info-border bg-tone-info-bg text-tone-info-fg'
}

function toAlertCardTone(severity: NavbarAlertVM['severity']): string {
  if (severity === 'danger') {
    return 'border-tone-danger-border/80 bg-tone-danger-bg/35'
  }
  if (severity === 'warning') {
    return 'border-tone-warning-border/80 bg-tone-warning-bg/35'
  }
  return 'border-tone-info-border/80 bg-tone-info-bg/35'
}

function toSeverityLabel(
  severity: NavbarAlertVM['severity'],
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (severity === 'danger') return t(keys.dashboard.alertIndicators.severity.danger)
  if (severity === 'warning') return t(keys.dashboard.alertIndicators.severity.warning)
  return t(keys.dashboard.alertIndicators.severity.info)
}

export function AlertItem(props: AlertItemProps): JSX.Element {
  const { t, keys } = useTranslation()

  const occurredAtLabel = () => {
    const formattedDate = formatDateForLocale(props.alert.occurredAt)
    const dateLabel =
      formattedDate.length > 0 ? formattedDate : t(keys.header.alertsPanel.valueUnavailable)
    return t(keys.header.alertsPanel.lastEvent, { date: dateLabel })
  }

  return (
    <button
      type="button"
      onClick={() => props.onOpenContainer()}
      class={`block w-full rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${toAlertCardTone(
        props.alert.severity,
      )} hover:border-tone-warning-strong hover:bg-tone-warning-bg/45`}
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs-ui font-medium text-foreground truncate">
            {t(props.alert.messageKey, props.alert.messageParams)}
          </p>
          <p class="mt-1 text-xs-ui text-text-muted">{occurredAtLabel()}</p>
        </div>
        <span
          class={`inline-flex shrink-0 rounded border px-1.5 py-0.5 text-micro font-semibold ${toSeverityClasses(
            props.alert.severity,
          )}`}
        >
          {toSeverityLabel(props.alert.severity, t, keys)}
        </span>
      </div>
      <Show when={props.alert.retroactive}>
        <span class="mt-1 inline-flex rounded border border-tone-warning-border bg-tone-warning-bg px-1.5 py-0.5 text-micro font-semibold text-tone-warning-fg">
          {t(keys.header.alertsPanel.retroactive)}
        </span>
      </Show>
    </button>
  )
}
