import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'
import type { NavbarIncidentVM } from '~/shared/ui/navbar-alerts/navbar-alerts.vm'
import { toCarrierDisplayLabel } from '~/shared/utils/carrierDisplay'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type AlertItemProps = {
  readonly processId: string
  readonly processReference: string | null
  readonly processCarrier: string | null
  readonly processRouteSummary: string
  readonly incident: NavbarIncidentVM
  readonly onOpenProcess: (processId: string) => void
  readonly onOpenContainer: (processId: string, containerNumber: string) => void
}

function toDisplayValue(value: string | null, fallback: string): string {
  if (value === null) return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function toSeverityClasses(severity: NavbarIncidentVM['severity']): string {
  if (severity === 'danger') {
    return 'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg'
  }
  if (severity === 'warning') {
    return 'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg'
  }
  return 'border-tone-info-border bg-tone-info-bg text-tone-info-fg'
}

function toAlertCardTone(severity: NavbarIncidentVM['severity']): string {
  if (severity === 'danger') {
    return 'border-tone-danger-border/80 bg-tone-danger-bg/35'
  }
  if (severity === 'warning') {
    return 'border-tone-warning-border/80 bg-tone-warning-bg/35'
  }
  return 'border-tone-info-border/80 bg-tone-info-bg/35'
}

function toAlertCardHoverTone(severity: NavbarIncidentVM['severity']): string {
  if (severity === 'danger') {
    return 'hover:border-tone-danger-strong hover:bg-tone-danger-bg/45'
  }
  if (severity === 'warning') {
    return 'hover:border-tone-warning-strong hover:bg-tone-warning-bg/45'
  }
  return 'hover:border-tone-info-strong hover:bg-tone-info-bg/45'
}

function toSeverityLabel(
  severity: NavbarIncidentVM['severity'],
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (severity === 'danger') return t(keys.dashboard.alertIndicators.severity.danger)
  if (severity === 'warning') return t(keys.dashboard.alertIndicators.severity.warning)
  return t(keys.dashboard.alertIndicators.severity.info)
}

export function AlertItem(props: AlertItemProps): JSX.Element {
  const { t, keys } = useTranslation()

  const processReferenceLabel = () => toDisplayValue(props.processReference, props.processId)

  const carrierLabel = () =>
    toDisplayValue(
      toCarrierDisplayLabel(props.processCarrier),
      t(keys.header.alertsPanel.valueUnavailable),
    )

  const routeSummaryLabel = () =>
    toDisplayValue(props.processRouteSummary, t(keys.header.alertsPanel.valueUnavailable))

  const occurredAtLabel = () => {
    const formattedDate = formatDateForLocale(props.incident.triggeredAt)
    const dateLabel =
      formattedDate.length > 0 ? formattedDate : t(keys.header.alertsPanel.valueUnavailable)
    return t(keys.header.alertsPanel.lastEvent, { date: dateLabel })
  }

  const actionLabel = () => {
    if (props.incident.action === null) return null
    const actionText = t(props.incident.action.actionKey, props.incident.action.actionParams)
    return t(keys.header.alertsPanel.actionLabel, {
      action: actionText,
    })
  }

  const affectedContainersLabel = () => {
    if (props.incident.affectedContainerCount === 1) {
      return t(keys.header.alertsPanel.affectedContainerSingle)
    }
    return t(keys.header.alertsPanel.affectedContainers, {
      count: props.incident.affectedContainerCount,
    })
  }

  const containersPreview = () => {
    const visible = props.incident.containers
      .slice(0, 3)
      .map((container) => container.containerNumber.trim())
      .filter((containerNumber) => containerNumber.length > 0)
    if (visible.length === 0) {
      return t(keys.header.alertsPanel.valueUnavailable)
    }
    const extra = Math.max(0, props.incident.containers.length - visible.length)
    if (extra === 0) {
      return visible.join(' · ')
    }
    return `${visible.join(' · ')} · ${t(keys.header.alertsPanel.moreContainers, { count: extra })}`
  }

  return (
    <div
      class={`rounded-md border px-2.5 py-2 ${toAlertCardTone(props.incident.severity)} ${toAlertCardHoverTone(
        props.incident.severity,
      )}`}
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate text-sm-ui font-semibold text-foreground">{processReferenceLabel()}</p>
        </div>
        <div class="flex shrink-0 items-start gap-1.5">
          <span
            class={`inline-flex rounded border px-1.5 py-0.5 text-micro font-semibold ${toSeverityClasses(
              props.incident.severity,
            )}`}
          >
            {toSeverityLabel(props.incident.severity, t, keys)}
          </span>
          <button
            type="button"
            onClick={() => props.onOpenProcess(props.processId)}
            class="inline-flex h-7 items-center justify-center rounded border border-border bg-surface px-2 text-xs-ui font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {t(keys.header.alertsPanel.openProcess)}
          </button>
        </div>
      </div>

      <p class="mt-1 truncate text-xs-ui text-text-muted">{carrierLabel()}</p>
      <p class="mt-1 truncate text-xs-ui text-text-muted">{routeSummaryLabel()}</p>

      <div class="mt-2.5">
        <p class="text-xs-ui font-medium text-foreground">
          {t(props.incident.factMessageKey, props.incident.factMessageParams)}
        </p>
        <Show when={props.incident.action !== null}>
          <p class="mt-1 text-xs-ui text-text-muted">{actionLabel()}</p>
        </Show>
        <p class="mt-1 text-xs-ui text-text-muted">{occurredAtLabel()}</p>
        <p class="mt-1 text-xs-ui text-text-muted">{affectedContainersLabel()}</p>
        <p class="mt-1 truncate font-mono text-micro text-text-muted">{containersPreview()}</p>
      </div>
    </div>
  )
}
