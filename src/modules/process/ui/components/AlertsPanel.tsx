import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { AlertIncidentItem } from '~/modules/process/ui/components/AlertIncidentItem'
import {
  countAffectedContainers,
  filterAlertIncidents,
  type ShipmentAlertIncidentFilter,
  toSortedAlertIncidents,
} from '~/modules/process/ui/screens/shipment/lib/shipmentAlertIncidents'
import type { AlertIncidentsVM } from '~/modules/process/ui/viewmodels/alert-incident.vm'
import { useTranslation } from '~/shared/localization/i18n'

type Props = {
  readonly alertIncidents: AlertIncidentsVM
  readonly busyAlertIds: ReadonlySet<string>
  readonly onAcknowledge: (alertIds: readonly string[]) => void
  readonly onUnacknowledge: (alertIds: readonly string[]) => void
  readonly onSelectContainer: (containerId: string) => void
}

type FilterOption = {
  readonly value: ShipmentAlertIncidentFilter
  readonly label: string
}

export function AlertsPanel(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const [filter, setFilter] = createSignal<ShipmentAlertIncidentFilter>('all')

  const sortedActiveIncidents = createMemo(() => toSortedAlertIncidents(props.alertIncidents.active))
  const sortedRecognizedIncidents = createMemo(() =>
    toSortedAlertIncidents(props.alertIncidents.recognized),
  )
  const visibleActiveIncidents = createMemo(() =>
    filterAlertIncidents(sortedActiveIncidents(), filter()),
  )
  const visibleRecognizedIncidents = createMemo(() =>
    filterAlertIncidents(sortedRecognizedIncidents(), filter()),
  )

  const summary = createMemo(() => ({
    activeIncidentCount: visibleActiveIncidents().length,
    affectedContainers: countAffectedContainers(visibleActiveIncidents()),
    recognizedIncidentCount: visibleRecognizedIncidents().length,
  }))

  const filterOptions = createMemo<readonly FilterOption[]>(() => [
    {
      value: 'all',
      label: t(keys.shipmentView.alerts.incidents.filters.all),
    },
    {
      value: 'movement',
      label: t(keys.shipmentView.alerts.incidents.filters.movement),
    },
    {
      value: 'eta',
      label: t(keys.shipmentView.alerts.incidents.filters.eta),
    },
    {
      value: 'customs',
      label: t(keys.shipmentView.alerts.incidents.filters.customs),
    },
    {
      value: 'data',
      label: t(keys.shipmentView.alerts.incidents.filters.data),
    },
    {
      value: 'status',
      label: t(keys.shipmentView.alerts.incidents.filters.status),
    },
  ])

  const hasAnyIncident = createMemo(
    () => props.alertIncidents.active.length > 0 || props.alertIncidents.recognized.length > 0,
  )

  return (
    <section id="shipment-alerts" class="space-y-2 scroll-mt-[120px]">
      <div class="rounded-lg border border-tone-warning-border border-t-2 border-t-tone-warning-strong bg-tone-warning-bg/35 p-2 shadow-sm backdrop-blur">
        <div class="space-y-2">
          <div class="space-y-1">
            <div class="flex items-center gap-1.5">
              <svg
                class="h-4 w-4 text-tone-warning-strong"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v3m0 3h.01m-7.732 4h15.464c1.308 0 2.126-1.417 1.472-2.55L13.732 4.45c-.654-1.133-2.29-1.133-2.944 0L2.806 16.45c-.654 1.133.164 2.55 1.472 2.55z"
                />
              </svg>
              <span class="text-sm-ui font-bold text-foreground">
                {t(keys.shipmentView.alerts.sectionTitle)}
              </span>
            </div>
            <p class="text-xs-ui text-text-muted">
              {t(keys.shipmentView.alerts.incidents.summary.activeLine, {
                incidents: summary().activeIncidentCount,
                containers: summary().affectedContainers,
              })}
            </p>
          </div>

          <div class="flex flex-wrap gap-1.5">
            <For each={filterOptions()}>
              {(option) => (
                <button
                  type="button"
                  classList={{
                    'border-border bg-surface text-text-muted': filter() !== option.value,
                    'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg':
                      filter() === option.value,
                  }}
                  class="inline-flex items-center rounded-full border px-2.5 py-1 text-micro font-semibold uppercase tracking-wide transition hover:bg-surface-muted"
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                </button>
              )}
            </For>
          </div>

          <Show
            when={visibleActiveIncidents().length > 0}
            fallback={
              <div class="rounded-md border border-border bg-surface px-2.5 py-2 text-xs-ui text-text-muted">
                {hasAnyIncident()
                  ? t(keys.shipmentView.alerts.incidents.emptyFiltered)
                  : t(keys.shipmentView.alerts.activeEmpty)}
              </div>
            }
          >
            <div class="space-y-2">
              <For each={visibleActiveIncidents()}>
                {(incident) => (
                  <AlertIncidentItem
                    incident={incident}
                    busyAlertIds={props.busyAlertIds}
                    onAcknowledgeIncident={props.onAcknowledge}
                    onUnacknowledgeIncident={props.onUnacknowledge}
                    onSelectContainer={props.onSelectContainer}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>

      <Show when={summary().recognizedIncidentCount > 0}>
        <details class="rounded-lg border border-border/70 bg-surface-muted/70 p-1.5">
          <summary class="cursor-pointer select-none text-micro font-medium uppercase tracking-wider text-text-muted">
            {t(keys.shipmentView.alerts.archived.title, {
              count: summary().recognizedIncidentCount,
            })}
          </summary>
          <div class="mt-2 space-y-2">
            <For each={visibleRecognizedIncidents()}>
              {(incident) => (
                <AlertIncidentItem
                  incident={incident}
                  busyAlertIds={props.busyAlertIds}
                  onAcknowledgeIncident={props.onAcknowledge}
                  onUnacknowledgeIncident={props.onUnacknowledge}
                  onSelectContainer={props.onSelectContainer}
                />
              )}
            </For>
          </div>
        </details>
      </Show>
    </section>
  )
}
