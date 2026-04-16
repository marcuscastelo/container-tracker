import { For, type JSX } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'
import { AlertItem } from '~/shared/ui/navbar-alerts/AlertItem'
import type {
  NavbarIncidentVM,
  NavbarProcessAlertGroupVM,
} from '~/shared/ui/navbar-alerts/navbar-alerts.vm'
import { toCarrierDisplayLabel } from '~/shared/utils/carrierDisplay'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type ProcessAlertGroupProps = {
  readonly process: NavbarProcessAlertGroupVM
  readonly onOpenProcess: (processId: string) => void
  readonly onOpenContainer: (processId: string, containerNumber: string) => void
}

function toDisplayValue(value: string | null, fallback: string): string {
  if (value === null) return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function toSeverityBadgeClasses(severity: NavbarProcessAlertGroupVM['dominantSeverity']): string {
  if (severity === 'danger') {
    return 'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg'
  }
  if (severity === 'warning') {
    return 'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg'
  }
  return 'border-tone-info-border bg-tone-info-bg text-tone-info-fg'
}

function ProcessSummary(props: {
  readonly process: NavbarProcessAlertGroupVM
  readonly onOpenProcess: (processId: string) => void
}): JSX.Element {
  const { t, keys } = useTranslation()

  const carrierLabel = () =>
    toDisplayValue(
      toCarrierDisplayLabel(props.process.carrier),
      t(keys.header.alertsPanel.valueUnavailable),
    )

  const routeSummaryLabel = () =>
    toDisplayValue(props.process.routeSummary, t(keys.header.alertsPanel.valueUnavailable))

  const latestIncidentLabel = () => {
    if (props.process.latestIncidentAt === null) {
      return t(keys.header.alertsPanel.valueUnavailable)
    }

    const formattedDate = formatDateForLocale(props.process.latestIncidentAt)
    return formattedDate.length > 0 ? formattedDate : t(keys.header.alertsPanel.valueUnavailable)
  }

  return (
    <div class="rounded-lg border border-border bg-surface p-2.5">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate text-sm-ui font-semibold text-foreground">
            {toDisplayValue(props.process.processReference, props.process.processId)}
          </p>
          <p class="truncate text-xs-ui text-text-muted">{carrierLabel()}</p>
          <p class="truncate text-xs-ui text-text-muted">{routeSummaryLabel()}</p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <span
            class={`rounded border px-1.5 py-0.5 text-micro font-semibold ${toSeverityBadgeClasses(
              props.process.dominantSeverity,
            )}`}
          >
            {t(keys.header.alertsPanel.alertsCount, { count: props.process.activeIncidentCount })}
          </span>
          <button
            type="button"
            onClick={() => props.onOpenProcess(props.process.processId)}
            class="motion-focus-surface motion-interactive inline-flex h-7 items-center justify-center rounded border border-border bg-surface px-2 text-xs-ui font-medium text-foreground hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {t(keys.header.alertsPanel.openProcess)}
          </button>
        </div>
      </div>

      <div class="mt-2 flex flex-wrap items-center gap-1.5 text-micro text-text-muted">
        <span class="rounded border border-border bg-surface-muted px-1.5 py-0.5 font-medium">
          {t(keys.header.alertsPanel.affectedContainers, {
            count: props.process.affectedContainerCount,
          })}
        </span>
        <span class="rounded border border-border bg-surface-muted px-1.5 py-0.5 font-medium">
          {t(keys.header.alertsPanel.lastEvent, { date: latestIncidentLabel() })}
        </span>
      </div>
    </div>
  )
}

function IncidentList(props: {
  readonly incidents: readonly NavbarIncidentVM[]
  readonly process: NavbarProcessAlertGroupVM
  readonly onOpenProcess: (processId: string) => void
  readonly onOpenContainer: (processId: string, containerNumber: string) => void
}): JSX.Element {
  return (
    <div class="space-y-2">
      <For each={props.incidents}>
        {(incident) => (
          <AlertItem
            processId={props.process.processId}
            processReference={props.process.processReference}
            processCarrier={props.process.carrier}
            processRouteSummary={props.process.routeSummary}
            incident={incident}
            onOpenProcess={props.onOpenProcess}
            onOpenContainer={props.onOpenContainer}
          />
        )}
      </For>
    </div>
  )
}

export function ProcessAlertGroup(props: ProcessAlertGroupProps): JSX.Element {
  return (
    <section class="space-y-2.5 rounded-lg border border-border bg-surface p-2.5">
      <ProcessSummary process={props.process} onOpenProcess={props.onOpenProcess} />
      <IncidentList
        incidents={props.process.incidents}
        process={props.process}
        onOpenProcess={props.onOpenProcess}
        onOpenContainer={props.onOpenContainer}
      />
    </section>
  )
}
