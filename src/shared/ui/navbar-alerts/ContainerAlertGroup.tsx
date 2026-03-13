import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { AlertItem } from '~/shared/ui/navbar-alerts/AlertItem'
import type { NavbarContainerAlertGroupVM } from '~/shared/ui/navbar-alerts/navbar-alerts.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type ContainerAlertGroupProps = {
  readonly processId: string
  readonly container: NavbarContainerAlertGroupVM
  readonly onOpenContainer: (processId: string, containerNumber: string) => void
}

function toDisplayValue(value: string | null, fallback: string): string {
  if (value === null) return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? value : fallback
}

export function ContainerAlertGroup(props: ContainerAlertGroupProps): JSX.Element {
  const { t, keys } = useTranslation()
  const etaLabel = () => {
    if (props.container.eta === null) return t(keys.header.alertsPanel.valueUnavailable)
    const formattedDate = formatDateForLocale(props.container.eta)
    return formattedDate.length > 0 ? formattedDate : t(keys.header.alertsPanel.valueUnavailable)
  }

  const openContainer = () => {
    props.onOpenContainer(props.processId, props.container.containerNumber)
  }

  return (
    <div class="space-y-2 rounded-lg border border-border bg-surface-muted/50 p-2">
      <button
        type="button"
        onClick={openContainer}
        class="block w-full rounded-md border border-border bg-surface px-2.5 py-2 text-left transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="font-mono text-sm-ui font-semibold text-foreground truncate">
            {props.container.containerNumber}
          </p>
          <span class="rounded border border-border bg-surface-muted px-1.5 py-0.5 text-micro font-semibold text-text-muted">
            {props.container.activeAlertsCount}
          </span>
        </div>
        <div class="mt-1 grid grid-cols-1 gap-1 text-xs-ui text-text-muted">
          <p>
            {t(keys.header.alertsPanel.containerStatus)}:{' '}
            {toDisplayValue(props.container.status, t(keys.header.alertsPanel.valueUnavailable))}
          </p>
          <p>
            {t(keys.header.alertsPanel.containerEta)}: {etaLabel()}
          </p>
        </div>
      </button>

      <For each={props.container.alerts}>
        {(alert) => <AlertItem alert={alert} onOpenContainer={openContainer} />}
      </For>
    </div>
  )
}
