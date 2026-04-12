import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'
import { ContainerAlertGroup } from '~/shared/ui/navbar-alerts/ContainerAlertGroup'
import type { NavbarProcessAlertGroupVM } from '~/shared/ui/navbar-alerts/navbar-alerts.vm'
import { toCarrierDisplayLabel } from '~/shared/utils/carrierDisplay'

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

export function ProcessAlertGroup(props: ProcessAlertGroupProps): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <section class="space-y-2.5 rounded-lg border border-border bg-surface p-2.5">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate text-sm-ui font-semibold text-foreground">
            {toDisplayValue(props.process.processReference, props.process.processId)}
          </p>
          <p class="truncate text-xs-ui text-text-muted">
            {toDisplayValue(
              toCarrierDisplayLabel(props.process.carrier),
              t(keys.header.alertsPanel.valueUnavailable),
            )}
          </p>
          <p class="truncate text-xs-ui text-text-muted">{props.process.routeSummary}</p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <span class="rounded border border-tone-danger-border bg-tone-danger-bg px-1.5 py-0.5 text-micro font-semibold text-tone-danger-fg">
            {t(keys.header.alertsPanel.alertsCount, { count: props.process.activeAlertsCount })}
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

      <For each={props.process.containers}>
        {(container) => (
          <ContainerAlertGroup
            processId={props.process.processId}
            container={container}
            onOpenContainer={props.onOpenContainer}
          />
        )}
      </For>
    </section>
  )
}
