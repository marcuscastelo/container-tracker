import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { AlertIcon } from '~/modules/process/ui/components/Icons'
import { formatRelativeTime } from '~/modules/process/ui/utils/formatRelativeTime'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'

type Props = {
  readonly alerts: readonly AlertDisplayVM[]
  readonly referenceNowIso: string | null
}

type HistoricalAlertCardProps = {
  readonly alert: AlertDisplayVM
  readonly relativeTriggeredAt: string
}

function severityClasses(severity: AlertDisplayVM['severity']): string {
  if (severity === 'danger') {
    return 'border-tone-danger-border bg-tone-danger-bg/85 text-tone-danger-fg'
  }
  if (severity === 'warning') {
    return 'border-tone-warning-border bg-tone-warning-bg/85 text-tone-warning-fg'
  }
  return 'border-tone-info-border bg-tone-info-bg/75 text-tone-info-fg'
}

function HistoricalAlertCard(props: HistoricalAlertCardProps): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <article class="rounded-lg border border-border/70 bg-surface-muted/70 px-3 py-2">
      <div class="flex items-start gap-2">
        <AlertIcon type={props.alert.type} />
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class={`inline-flex rounded border px-1.5 py-0.5 text-micro font-bold uppercase tracking-wide ${severityClasses(
                props.alert.severity,
              )}`}
            >
              {t(keys.shipmentView.alerts.severity[props.alert.severity])}
            </span>
            <span class="text-micro text-text-muted">{props.relativeTriggeredAt}</span>
          </div>
          <p class="text-sm-ui font-medium text-foreground">
            {t(props.alert.messageKey, props.alert.messageParams)}
          </p>
        </div>
      </div>
    </article>
  )
}

export function TrackingTimeTravelAlertsPanel(props: Props): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const referenceNow = () => (props.referenceNowIso ? new Date(props.referenceNowIso) : new Date())

  return (
    <Panel
      title={t(keys.shipmentView.timeTravel.alertsTitle)}
      class="rounded-xl"
      bodyClass="space-y-2 px-3 py-3"
    >
      <Show
        when={props.alerts.length > 0}
        fallback={
          <p class="text-xs-ui text-text-muted">{t(keys.shipmentView.timeTravel.alertsEmpty)}</p>
        }
      >
        <div class="space-y-2">
          <For each={props.alerts}>
            {(alert) => (
              <HistoricalAlertCard
                alert={alert}
                relativeTriggeredAt={formatRelativeTime(
                  alert.triggeredAtIso,
                  referenceNow(),
                  locale(),
                )}
              />
            )}
          </For>
        </div>
      </Show>
    </Panel>
  )
}
