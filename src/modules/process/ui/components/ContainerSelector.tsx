import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { toContainerSyncLabel } from '~/modules/process/ui/mappers/containerSync.ui-mapper'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import { toContainerEtaChipLabel } from '~/modules/process/ui/utils/eta-labels'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { StatusBadge } from '~/shared/ui/StatusBadge'

type ContainerSelectorItemLabels = {
  readonly etaArrived: string
  readonly etaExpectedPrefix: string
  readonly etaDelayed: string
  readonly etaMissing: string
  readonly dataIssue: string
  readonly syncing: string
  readonly never: string
  readonly updatedUnknownTime: string
  readonly failedUnknownTime: string
  readonly updated: (relative: string) => string
  readonly failed: (relative: string) => string
  readonly etaLabel: string
  readonly internalReferenceLabel: string
  readonly lastUpdateLabel: string
  readonly unknown: string
}

function toContainerReference(container: ContainerDetailVM): string {
  if (!container.id) return '—'
  return `REF-${container.id.slice(0, 8).toUpperCase()}`
}

function MetaRow(props: {
  readonly icon: JSX.Element
  readonly label: string
  readonly value: string
}): JSX.Element {
  return (
    <div class="flex items-center gap-1.5 text-xs-ui text-slate-600">
      <span class="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-slate-400">
        {props.icon}
      </span>
      <span class="font-medium text-slate-500">{props.label}:</span>
      <span class="truncate text-slate-700">{props.value}</span>
    </div>
  )
}

function ContainerSelectorItem(props: {
  readonly container: ContainerDetailVM
  readonly selected: boolean
  readonly onSelect: (id: string) => void
  readonly labels: ContainerSelectorItemLabels
  readonly statusLabel: string
  readonly syncNow: Date
  readonly locale: string
}): JSX.Element {
  const etaValue = () =>
    toContainerEtaChipLabel(props.container.etaChipVm, {
      arrived: props.labels.etaArrived,
      expectedPrefix: props.labels.etaExpectedPrefix,
      delayed: props.labels.etaDelayed,
      missing: props.labels.etaMissing,
    })

  const syncLabel = () =>
    toContainerSyncLabel(
      props.container.sync,
      {
        syncing: props.labels.syncing,
        never: props.labels.never,
        updatedUnknownTime: props.labels.updatedUnknownTime,
        failedUnknownTime: props.labels.failedUnknownTime,
        updated: props.labels.updated,
        failed: props.labels.failed,
      },
      {
        now: props.syncNow,
        locale: props.locale,
      },
    )

  const cardClass = () => {
    if (props.selected) {
      return 'border-[color:var(--color-primary)] bg-blue-50/60 shadow-[0_1px_2px_rgba(44,47,89,0.18)] ring-1 ring-blue-100'
    }

    return 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
  }

  return (
    <button
      type="button"
      data-testid={`container-card-${props.container.id}`}
      onClick={() => props.onSelect(props.container.id)}
      class={`w-full rounded-lg border p-3 text-left transition-colors ${cardClass()}`}
    >
      <div class="flex items-start justify-between gap-2">
        <span class="truncate text-sm-ui font-semibold tracking-wide text-slate-900">
          {props.container.number}
        </span>
        <StatusBadge variant={props.container.status} label={props.statusLabel} />
      </div>

      <div class="mt-2.5 space-y-1.5">
        <MetaRow
          icon={
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10m-12 9h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2z"
              />
            </svg>
          }
          label={props.labels.etaLabel}
          value={etaValue()}
        />

        <MetaRow
          icon={
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 7h16M4 12h8m-8 5h16"
              />
            </svg>
          }
          label={props.labels.internalReferenceLabel}
          value={toContainerReference(props.container)}
        />

        <MetaRow
          icon={
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          label={props.labels.lastUpdateLabel}
          value={syncLabel() ?? props.labels.unknown}
        />
      </div>

      <Show when={props.container.dataIssueChipVm.visible}>
        <span class="mt-2 inline-flex rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-micro font-medium text-amber-700">
          {props.labels.dataIssue}
        </span>
      </Show>
    </button>
  )
}

export function ContainerSelector(props: {
  containers: readonly ContainerDetailVM[]
  selectedId: string
  onSelect: (id: string) => void
  syncNow: Date
}): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const labels: ContainerSelectorItemLabels = {
    etaArrived: t(keys.shipmentView.operational.chips.etaArrived),
    etaExpectedPrefix: t(keys.shipmentView.operational.chips.etaExpected),
    etaDelayed: t(keys.shipmentView.operational.header.selectedExpectedDelayed),
    etaMissing: t(keys.shipmentView.operational.chips.etaMissing),
    dataIssue: t(keys.shipmentView.operational.chips.dataIssue),
    syncing: t(keys.shipmentView.sync.syncing),
    never: t(keys.shipmentView.sync.never),
    updatedUnknownTime: t(keys.shipmentView.sync.updatedUnknownTime),
    failedUnknownTime: t(keys.shipmentView.sync.failedUnknownTime),
    updated: (relative: string) => t(keys.shipmentView.sync.updated, { relative }),
    failed: (relative: string) => t(keys.shipmentView.sync.failed, { relative }),
    etaLabel: t(keys.shipmentView.currentStatus.eta),
    internalReferenceLabel: t(keys.shipmentView.containers.internalReference),
    lastUpdateLabel: t(keys.shipmentView.currentStatus.lastUpdate),
    unknown: t(keys.shipmentView.currentStatus.unknown),
  }

  return (
    <div class="space-y-2.5 px-3 py-3">
      <For each={props.containers}>
        {(container) => (
          <ContainerSelectorItem
            container={container}
            selected={String(props.selectedId) === String(container.id)}
            onSelect={props.onSelect}
            labels={labels}
            statusLabel={t(trackingStatusToLabelKey(keys, container.statusCode))}
            syncNow={props.syncNow}
            locale={locale()}
          />
        )}
      </For>
    </div>
  )
}
