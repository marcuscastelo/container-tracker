import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { AlertIncidentItem } from '~/modules/process/ui/components/AlertIncidentItem'
import { fetchRecognizedAlertIncidents } from '~/modules/process/ui/fetchProcessTrackingDetails'
import {
  countAffectedContainers,
  filterAlertIncidents,
  type ShipmentAlertIncidentFilter,
  toAlertsPanelEmptyStateKind,
  toDuplicateTransshipmentIncidentKeys,
  toSortedAlertIncidents,
} from '~/modules/process/ui/screens/shipment/lib/shipmentAlertIncidents'
import type {
  AlertIncidentsVM,
  AlertIncidentVM,
} from '~/modules/process/ui/viewmodels/alert-incident.vm'
import { useTranslation } from '~/shared/localization/i18n'

type Props = {
  readonly processId: string
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

type AlertIncidentHandlers = Pick<
  Props,
  'busyAlertIds' | 'onAcknowledge' | 'onUnacknowledge' | 'onSelectContainer'
>

function AlertsPanelHeader(props: { readonly summaryLine: string }): JSX.Element {
  const { t, keys } = useTranslation()

  return (
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
      <p class="text-xs-ui text-text-muted">{props.summaryLine}</p>
    </div>
  )
}

function AlertsPanelFilters(props: {
  readonly options: readonly FilterOption[]
  readonly selectedFilter: ShipmentAlertIncidentFilter
  readonly onSelect: (filter: ShipmentAlertIncidentFilter) => void
}): JSX.Element {
  return (
    <div class="flex flex-wrap gap-1.5">
      <For each={props.options}>
        {(option) => (
          <button
            type="button"
            classList={{
              'border-border bg-surface text-text-muted': props.selectedFilter !== option.value,
              'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg':
                props.selectedFilter === option.value,
            }}
            class="inline-flex items-center rounded-full border px-2.5 py-1 text-micro font-semibold uppercase tracking-wide transition hover:bg-surface-muted"
            onClick={() => props.onSelect(option.value)}
          >
            {option.label}
          </button>
        )}
      </For>
    </div>
  )
}

function AlertsPanelEmptyState(props: {
  readonly kind: 'activeEmpty' | 'emptyFiltered'
}): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="rounded-md border border-border bg-surface px-2.5 py-2 text-xs-ui text-text-muted">
      {props.kind === 'emptyFiltered'
        ? t(keys.shipmentView.alerts.incidents.emptyFiltered)
        : t(keys.shipmentView.alerts.activeEmpty)}
    </div>
  )
}

function AlertIncidentList(
  props: {
    readonly incidents: readonly AlertIncidentVM[]
    readonly duplicatedTransshipmentIncidentKeys: ReadonlySet<string>
  } & AlertIncidentHandlers,
): JSX.Element {
  return (
    <div class="space-y-2">
      <For each={props.incidents}>
        {(incident) => (
          <AlertIncidentItem
            incident={incident}
            busyAlertIds={props.busyAlertIds}
            onAcknowledgeIncident={props.onAcknowledge}
            onUnacknowledgeIncident={props.onUnacknowledge}
            onSelectContainer={props.onSelectContainer}
            showTransshipmentOccurrence={props.duplicatedTransshipmentIncidentKeys.has(
              incident.incidentKey,
            )}
          />
        )}
      </For>
    </div>
  )
}

function RecognizedIncidentsSection(
  props: {
    readonly count: number
    readonly incidents: readonly AlertIncidentVM[]
    readonly duplicatedTransshipmentIncidentKeys: ReadonlySet<string>
    readonly loading: boolean
    readonly errorMessage: string | null
    readonly onToggle: (isOpen: boolean) => void
  } & AlertIncidentHandlers,
): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <details
      class="rounded-lg border border-border/70 bg-surface-muted/70 p-1.5"
      onToggle={(event: Event & { readonly currentTarget: HTMLDetailsElement }) =>
        props.onToggle(event.currentTarget.open)
      }
    >
      <summary class="cursor-pointer select-none text-micro font-medium uppercase tracking-wider text-text-muted">
        {t(keys.shipmentView.alerts.archived.title, {
          count: props.count,
        })}
      </summary>
      <div class="mt-2">
        <Show
          when={!props.loading}
          fallback={
            <div class="rounded-md border border-border bg-surface px-2.5 py-2 text-xs-ui text-text-muted">
              {t(keys.shipmentView.loading)}
            </div>
          }
        >
          <Show
            when={props.errorMessage === null}
            fallback={
              <div class="rounded-md border border-tone-danger-border bg-tone-danger-bg px-2.5 py-2 text-xs-ui text-tone-danger-fg">
                {props.errorMessage ?? t(keys.shipmentView.loadError)}
              </div>
            }
          >
            <Show
              when={props.incidents.length > 0}
              fallback={<AlertsPanelEmptyState kind="emptyFiltered" />}
            >
              <AlertIncidentList
                incidents={props.incidents}
                duplicatedTransshipmentIncidentKeys={props.duplicatedTransshipmentIncidentKeys}
                busyAlertIds={props.busyAlertIds}
                onAcknowledge={props.onAcknowledge}
                onUnacknowledge={props.onUnacknowledge}
                onSelectContainer={props.onSelectContainer}
              />
            </Show>
          </Show>
        </Show>
      </div>
    </details>
  )
}

export function AlertsPanel(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const [filter, setFilter] = createSignal<ShipmentAlertIncidentFilter>('all')
  const [recognizedIncidents, setRecognizedIncidents] = createSignal<readonly AlertIncidentVM[]>(
    props.alertIncidents.recognized,
  )
  const [recognizedLoading, setRecognizedLoading] = createSignal(false)
  const [recognizedErrorMessage, setRecognizedErrorMessage] = createSignal<string | null>(null)

  createEffect(() => {
    props.processId
    setRecognizedIncidents(props.alertIncidents.recognized)
    setRecognizedLoading(false)
    setRecognizedErrorMessage(null)
  })

  const sortedActiveIncidents = createMemo(() =>
    toSortedAlertIncidents(props.alertIncidents.active),
  )
  const sortedRecognizedIncidents = createMemo(() => toSortedAlertIncidents(recognizedIncidents()))
  const visibleActiveIncidents = createMemo(() =>
    filterAlertIncidents(sortedActiveIncidents(), filter()),
  )
  const visibleRecognizedIncidents = createMemo(() =>
    filterAlertIncidents(sortedRecognizedIncidents(), filter()),
  )
  const duplicatedActiveTransshipmentIncidentKeys = createMemo(() =>
    toDuplicateTransshipmentIncidentKeys(sortedActiveIncidents()),
  )
  const duplicatedRecognizedTransshipmentIncidentKeys = createMemo(() =>
    toDuplicateTransshipmentIncidentKeys(sortedRecognizedIncidents()),
  )

  const summary = createMemo(() => ({
    activeIncidentCount: visibleActiveIncidents().length,
    affectedContainers: countAffectedContainers(visibleActiveIncidents()),
    recognizedIncidentCount: props.alertIncidents.summary.recognizedIncidents,
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

  const emptyStateKind = createMemo(() =>
    toAlertsPanelEmptyStateKind({
      hasVisibleActiveIncidents: visibleActiveIncidents().length > 0,
      hasAnyActiveIncidents: props.alertIncidents.active.length > 0,
    }),
  )

  const loadRecognizedIncidents = async (): Promise<void> => {
    if (recognizedLoading()) return
    if (recognizedIncidents().length > 0) return
    if (props.alertIncidents.summary.recognizedIncidents === 0) return

    setRecognizedLoading(true)
    setRecognizedErrorMessage(null)

    try {
      const incidents = await fetchRecognizedAlertIncidents(props.processId)
      setRecognizedIncidents(incidents)
    } catch (error) {
      console.error(`Failed to load recognized alert incidents for ${props.processId}:`, error)
      setRecognizedErrorMessage(t(keys.shipmentView.loadError))
    } finally {
      setRecognizedLoading(false)
    }
  }

  return (
    <section id="shipment-alerts" class="space-y-2 scroll-mt-[120px]">
      <div class="rounded-lg border border-tone-warning-border border-t-2 border-t-tone-warning-strong bg-tone-warning-bg/35 p-2 shadow-sm backdrop-blur">
        <div class="space-y-2">
          <AlertsPanelHeader
            summaryLine={t(keys.shipmentView.alerts.incidents.summary.activeLine, {
              incidents: summary().activeIncidentCount,
              containers: summary().affectedContainers,
            })}
          />
          <AlertsPanelFilters
            options={filterOptions()}
            selectedFilter={filter()}
            onSelect={setFilter}
          />

          <Show
            when={visibleActiveIncidents().length > 0}
            fallback={<AlertsPanelEmptyState kind={emptyStateKind() ?? 'activeEmpty'} />}
          >
            <AlertIncidentList
              incidents={visibleActiveIncidents()}
              duplicatedTransshipmentIncidentKeys={duplicatedActiveTransshipmentIncidentKeys()}
              busyAlertIds={props.busyAlertIds}
              onAcknowledge={props.onAcknowledge}
              onUnacknowledge={props.onUnacknowledge}
              onSelectContainer={props.onSelectContainer}
            />
          </Show>
        </div>
      </div>

      <Show when={summary().recognizedIncidentCount > 0}>
        <RecognizedIncidentsSection
          count={summary().recognizedIncidentCount}
          incidents={visibleRecognizedIncidents()}
          duplicatedTransshipmentIncidentKeys={duplicatedRecognizedTransshipmentIncidentKeys()}
          loading={recognizedLoading()}
          errorMessage={recognizedErrorMessage()}
          onToggle={(isOpen) => {
            if (!isOpen) return
            void loadRecognizedIncidents()
          }}
          busyAlertIds={props.busyAlertIds}
          onAcknowledge={props.onAcknowledge}
          onUnacknowledge={props.onUnacknowledge}
          onSelectContainer={props.onSelectContainer}
        />
      </Show>
    </section>
  )
}
