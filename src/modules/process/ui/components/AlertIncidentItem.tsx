import clsx from 'clsx'
import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import type {
  AlertIncidentMemberVM,
  AlertIncidentVM,
} from '~/modules/process/ui/viewmodels/alert-incident.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { systemClock } from '~/shared/time/clock'
import { parseInstantFromIso } from '~/shared/time/parsing'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type Props = {
  readonly incident: AlertIncidentVM
  readonly busyAlertIds: ReadonlySet<string>
  readonly onAcknowledgeIncident: (alertIds: readonly string[]) => void
  readonly onUnacknowledgeIncident: (alertIds: readonly string[]) => void
  readonly onSelectContainer: (containerId: string) => void
}

function toSeverityBadgeClasses(severity: AlertIncidentVM['severity']): string {
  if (severity === 'danger') {
    return 'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg'
  }
  if (severity === 'warning') {
    return 'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg'
  }
  return 'border-tone-info-border bg-tone-info-bg text-tone-info-fg'
}

function toCardClasses(severity: AlertIncidentVM['severity']): string {
  if (severity === 'danger') {
    return 'border-tone-danger-border bg-tone-danger-bg/60 border-l-tone-danger-strong'
  }
  if (severity === 'warning') {
    return 'border-tone-warning-border bg-tone-warning-bg/60 border-l-tone-warning-strong'
  }
  return 'border-tone-info-border bg-tone-info-bg/55 border-l-tone-info-strong'
}

function formatIncidentAge(
  triggeredAtIso: string,
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  const triggeredAt = parseInstantFromIso(triggeredAtIso)
  if (triggeredAt === null) return ''

  const diffMs = systemClock.now().diffMs(triggeredAt)
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return t(keys.shipmentView.alerts.aging.now)

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t(keys.shipmentView.alerts.aging.minutes, { count: minutes })

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t(keys.shipmentView.alerts.aging.hours, { count: hours })

  const days = Math.floor(hours / 24)
  return t(keys.shipmentView.alerts.aging.days, { count: days })
}

function toSeverityLabel(
  severity: AlertIncidentVM['severity'],
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (severity === 'danger') return t(keys.shipmentView.alerts.severity.danger)
  if (severity === 'warning') return t(keys.shipmentView.alerts.severity.warning)
  return t(keys.shipmentView.alerts.severity.info)
}

function toCategoryLabel(
  category: AlertIncidentVM['category'],
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  switch (category) {
    case 'movement':
      return t(keys.shipmentView.alerts.category.movement)
    case 'eta':
      return t(keys.shipmentView.alerts.category.eta)
    case 'customs':
      return t(keys.shipmentView.alerts.category.customs)
    case 'status':
      return t(keys.shipmentView.alerts.category.status)
    case 'data':
      return t(keys.shipmentView.alerts.category.data)
  }
}

function toLifecycleLabel(
  lifecycleState: AlertIncidentMemberVM['lifecycleState'],
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (lifecycleState === 'ACTIVE') {
    return t(keys.shipmentView.alerts.incidents.lifecycle.active)
  }
  if (lifecycleState === 'ACKED') {
    return t(keys.shipmentView.alerts.incidents.lifecycle.acknowledged)
  }
  return t(keys.shipmentView.alerts.incidents.lifecycle.autoResolved)
}

function toLifecycleChipClasses(lifecycleState: AlertIncidentMemberVM['lifecycleState']): string {
  if (lifecycleState === 'ACTIVE') {
    return 'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg'
  }
  if (lifecycleState === 'ACKED') {
    return 'border-border bg-surface-muted text-text-muted'
  }
  return 'border-tone-info-border bg-tone-info-bg text-tone-info-fg'
}

function toIncidentTitle(
  incident: AlertIncidentVM,
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (incident.type === 'NO_MOVEMENT' && incident.thresholdDays !== null) {
    return t(keys.shipmentView.alerts.incidents.title.noMovementThreshold, {
      days: incident.thresholdDays,
    })
  }

  return t(incident.messageKey, incident.messageParams)
}

function toContainerPreview(
  incident: AlertIncidentVM,
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  const containerNumbers = incident.members.map((member) => member.containerNumber)
  const preview = containerNumbers.slice(0, 3).join(', ')
  const remainingCount = Math.max(containerNumbers.length - 3, 0)
  const previewWithRemaining =
    remainingCount > 0
      ? t(keys.shipmentView.alerts.incidents.preview.withRemaining, {
          preview,
          count: remainingCount,
        })
      : preview

  return t(keys.shipmentView.alerts.incidents.preview.containers, {
    count: incident.affectedContainerCount,
    containers: previewWithRemaining,
  })
}

function toIncidentSummary(
  incident: AlertIncidentVM,
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (incident.type === 'NO_MOVEMENT') {
    return t(keys.shipmentView.alerts.incidents.summary.noMovement, {
      count: incident.affectedContainerCount,
      date:
        incident.lastEventDate === null
          ? t(keys.header.alertsPanel.valueUnavailable)
          : formatDateForLocale(incident.lastEventDate),
    })
  }

  return toContainerPreview(incident, t, keys)
}

function toMemberActiveAlertIds(member: AlertIncidentMemberVM): readonly string[] {
  return member.records
    .filter((record) => record.lifecycleState === 'ACTIVE')
    .map((record) => record.alertId)
}

export function AlertIncidentItem(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const [isExpanded, setIsExpanded] = createSignal(false)
  const relatedAlertIds = createMemo(() => [
    ...props.incident.activeAlertIds,
    ...props.incident.ackedAlertIds,
  ])
  const isBusy = createMemo(() =>
    relatedAlertIds().some((alertId) => props.busyAlertIds.has(alertId)),
  )
  const canAcknowledge = createMemo(
    () => props.incident.bucket === 'active' && props.incident.activeAlertIds.length > 0,
  )
  const canAcknowledgeAllContainers = createMemo(
    () => canAcknowledge() && props.incident.affectedContainerCount > 1,
  )
  const canUnacknowledge = createMemo(
    () => props.incident.bucket === 'recognized' && props.incident.ackedAlertIds.length > 0,
  )

  return (
    <article
      class={clsx(
        'rounded-lg border border-l-4 px-3 py-2 shadow-sm transition-colors',
        toCardClasses(props.incident.severity),
      )}
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex flex-wrap items-center gap-1.5">
            <span
              class={clsx(
                'inline-flex items-center rounded border px-1.5 py-0.5 text-micro font-bold leading-none',
                toSeverityBadgeClasses(props.incident.severity),
              )}
            >
              {toSeverityLabel(props.incident.severity, t, keys)}
            </span>
            <span class="inline-flex items-center rounded bg-secondary px-1.5 py-0.5 text-micro font-medium text-text-muted">
              {toCategoryLabel(props.incident.category, t, keys)}
            </span>
            <span class="text-micro font-medium text-text-muted">
              {formatIncidentAge(props.incident.triggeredAtIso, t, keys)}
            </span>
          </div>

          <p class="text-sm-ui font-semibold leading-tight text-foreground">
            {toIncidentTitle(props.incident, t, keys)}
          </p>
          <p class="text-xs-ui text-text-muted">{toIncidentSummary(props.incident, t, keys)}</p>
        </div>

        <button
          type="button"
          class="inline-flex h-8 shrink-0 items-center rounded border border-border bg-surface px-2 text-micro font-semibold uppercase tracking-wide text-text-muted transition hover:bg-surface-muted"
          aria-expanded={isExpanded()}
          onClick={() => setIsExpanded((value) => !value)}
        >
          {isExpanded()
            ? t(keys.shipmentView.alerts.incidents.collapse)
            : t(keys.shipmentView.alerts.incidents.expand)}
        </button>
      </div>

      <Show when={isExpanded()}>
        <div class="mt-3 space-y-3 border-t border-border/70 pt-3">
          <div class="space-y-2">
            <p class="text-micro font-semibold uppercase tracking-wide text-text-muted">
              {t(keys.shipmentView.alerts.incidents.details.containers)}
            </p>

            <div class="space-y-2">
              <For each={props.incident.members}>
                {(member) => (
                  <div class="rounded-md border border-border/70 bg-surface/70 px-3 py-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        class="text-sm-ui font-semibold text-foreground underline-offset-2 hover:underline"
                        onClick={() => props.onSelectContainer(member.containerId)}
                      >
                        {member.containerNumber}
                      </button>
                      <span
                        class={clsx(
                          'inline-flex items-center rounded border px-1.5 py-0.5 text-micro font-medium',
                          toLifecycleChipClasses(member.lifecycleState),
                        )}
                      >
                        {toLifecycleLabel(member.lifecycleState, t, keys)}
                      </span>
                    </div>

                    <div class="mt-2 grid gap-1 text-xs-ui text-text-muted">
                      <Show when={member.transshipmentOrder !== null}>
                        <p>
                          {t(keys.shipmentView.alerts.incidents.details.transshipmentOrder)}:{' '}
                          <span class="font-medium text-foreground">{member.transshipmentOrder}</span>
                        </p>
                      </Show>
                      <Show when={member.port !== null}>
                        <p>
                          {t(keys.shipmentView.alerts.incidents.details.location)}:{' '}
                          <span class="font-medium text-foreground">{member.port}</span>
                        </p>
                      </Show>
                      <Show when={member.fromVessel !== null}>
                        <p>
                          {t(keys.shipmentView.alerts.incidents.details.fromVessel)}:{' '}
                          <span class="font-medium text-foreground">{member.fromVessel}</span>
                        </p>
                      </Show>
                      <Show when={member.toVessel !== null}>
                        <p>
                          {t(keys.shipmentView.alerts.incidents.details.toVessel)}:{' '}
                          <span class="font-medium text-foreground">{member.toVessel}</span>
                        </p>
                      </Show>
                      <Show when={member.lastEventDate !== null}>
                        <p>
                          {t(keys.shipmentView.alerts.incidents.details.lastEvent)}:{' '}
                          <span class="font-medium text-foreground">
                            {formatDateForLocale(member.lastEventDate ?? '')}
                          </span>
                        </p>
                      </Show>
                    </div>

                    <Show when={props.incident.bucket === 'active'}>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={toMemberActiveAlertIds(member).length === 0 || isBusy()}
                          class="inline-flex items-center rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-semibold text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() =>
                            props.onAcknowledgeIncident(toMemberActiveAlertIds(member))
                          }
                        >
                          {t(keys.shipmentView.alerts.action.acknowledgeContainer)}
                        </button>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>

          <Show when={props.incident.monitoringHistory.length > 0}>
            <div class="space-y-2">
              <p class="text-micro font-semibold uppercase tracking-wide text-text-muted">
                {t(keys.shipmentView.alerts.incidents.details.history)}
              </p>

              <ul class="space-y-1 text-xs-ui text-text-muted">
                <For each={props.incident.monitoringHistory}>
                  {(record) => (
                    <li class="list-none">
                      <span class="font-medium text-foreground">
                        {record.thresholdDays ?? 0}d
                      </span>{' '}
                      {t(keys.shipmentView.alerts.incidents.details.thresholdReachedOn, {
                        date:
                          record.lastEventDate === null
                            ? t(keys.header.alertsPanel.valueUnavailable)
                            : formatDateForLocale(record.lastEventDate),
                      })}
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Show>

          <div class="flex flex-wrap gap-2">
            <Show when={canAcknowledgeAllContainers()}>
              <button
                type="button"
                disabled={isBusy()}
                class="inline-flex items-center rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-semibold text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => props.onAcknowledgeIncident(props.incident.activeAlertIds)}
              >
                {t(keys.shipmentView.alerts.action.acknowledgeIncident, {
                  count: props.incident.affectedContainerCount,
                })}
              </button>
            </Show>

            <Show when={canUnacknowledge()}>
              <button
                type="button"
                disabled={isBusy()}
                class="inline-flex items-center rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-semibold text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => props.onUnacknowledgeIncident(props.incident.ackedAlertIds)}
              >
                {t(keys.shipmentView.alerts.action.unacknowledge)}
              </button>
            </Show>
          </div>
        </div>
      </Show>
    </article>
  )
}
