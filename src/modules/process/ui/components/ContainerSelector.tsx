import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { toContainerSyncLabel } from '~/modules/process/ui/mappers/containerSync.ui-mapper'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import { toContainerEtaChipLabel } from '~/modules/process/ui/utils/eta-labels'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import type { TrackingStatusCode } from '~/modules/tracking/application/projection/tracking.status.projection'
import { useTranslation } from '~/shared/localization/i18n'
import { CopyButton } from '~/shared/ui/CopyButton'
import { StatusBadge } from '~/shared/ui/StatusBadge'

function etaChipClass(tone: ContainerDetailVM['etaChipVm']['tone'], selected: boolean): string {
  if (selected) {
    return 'bg-slate-600/60 text-slate-100'
  }

  switch (tone) {
    case 'positive':
      return 'bg-emerald-50 text-emerald-700'
    case 'informative':
      return 'bg-blue-50 text-blue-700'
    case 'warning':
      return 'bg-amber-50 text-amber-700'
    default:
      return 'bg-slate-50 text-slate-500'
  }
}

type ContainerSelectorItemLabels = {
  readonly etaArrived: string
  readonly etaExpectedPrefix: string
  readonly etaDelayed: string
  readonly etaMissing: string
  readonly ts: (count: number) => string
  readonly dataIssue: string
  readonly copyContainerNumber: string
  readonly syncing: string
  readonly never: string
  readonly updatedUnknownTime: string
  readonly failedUnknownTime: string
  readonly updated: (relative: string) => string
  readonly failed: (relative: string) => string
}

/** Status codes for which ETA is no longer meaningful */
const COMPLETED_STATUS_CODES: ReadonlySet<TrackingStatusCode> = new Set([
  'DELIVERED',
  'EMPTY_RETURNED',
  'DISCHARGED',
  'AVAILABLE_FOR_PICKUP',
])

function isContainerCompleted(statusCode: TrackingStatusCode): boolean {
  return COMPLETED_STATUS_CODES.has(statusCode)
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
  const completed = () => isContainerCompleted(props.container.statusCode)
  const showEtaChip = () => !completed()
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

  return (
    <div
      data-testid={`container-card-${props.container.id}`}
      class={`flex items-center gap-1 rounded border px-2 py-1 text-sm-ui font-medium transition-all cursor-pointer ${
        props.selected
          ? 'border-slate-600 bg-slate-700 text-white shadow-sm ring-2 ring-slate-400/30'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-gray-100 hover:shadow-sm active:bg-slate-100'
      }`}
    >
      <button
        type="button"
        onClick={() => props.onSelect(props.container.id)}
        class="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 text-left"
      >
        {/* Row 1: Container number + status badge */}
        <div class="flex items-center gap-1">
          <span class="font-semibold tracking-wide text-xs-ui leading-tight">
            {props.container.number}
          </span>
          <StatusBadge variant={props.container.status} label={props.statusLabel} />
        </div>
        {/* Row 2: ETA / TS / Data chips */}
        <div class="flex items-center gap-1">
          <Show when={showEtaChip()}>
            <span
              data-testid={`container-eta-chip-${props.container.id}`}
              class={`inline-flex rounded px-1 py-px text-micro font-medium leading-none ${etaChipClass(
                props.container.etaChipVm.tone,
                props.selected,
              )}`}
            >
              {toContainerEtaChipLabel(props.container.etaChipVm, {
                arrived: props.labels.etaArrived,
                expectedPrefix: props.labels.etaExpectedPrefix,
                delayed: props.labels.etaDelayed,
                missing: props.labels.etaMissing,
              })}
            </span>
          </Show>
          <Show when={props.container.tsChipVm.visible}>
            <span
              data-testid={`container-int-chip-${props.container.id}`}
              class={`inline-flex rounded px-1 py-px text-micro font-medium leading-none ${
                props.selected ? 'bg-slate-600/60 text-slate-200' : 'bg-slate-100 text-slate-400'
              }`}
              title={props.container.tsChipVm.portsTooltip ?? undefined}
            >
              {props.labels.ts(props.container.tsChipVm.count)}
            </span>
          </Show>
          <Show when={props.container.dataIssueChipVm.visible}>
            <span
              data-testid={`container-data-chip-${props.container.id}`}
              class={`inline-flex rounded px-1 py-px text-micro font-medium leading-none ${
                props.selected ? 'bg-slate-600/60 text-slate-200' : 'bg-amber-50 text-amber-600'
              }`}
            >
              {props.labels.dataIssue}
            </span>
          </Show>
        </div>
        <div
          data-testid={`container-sync-chip-${props.container.id}`}
          class={`text-micro leading-none ${props.selected ? 'text-slate-200' : 'text-slate-400'}`}
        >
          {syncLabel()}
        </div>
      </button>
      <CopyButton
        text={props.container.number}
        title={props.labels.copyContainerNumber}
        class="inline-flex shrink-0"
      />
    </div>
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
    ts: (count: number) => t(keys.shipmentView.operational.chips.ts, { count }),
    dataIssue: t(keys.shipmentView.operational.chips.dataIssue),
    copyContainerNumber: t(keys.process.containerSelector.copyContainerNumber),
    syncing: t(keys.shipmentView.sync.syncing),
    never: t(keys.shipmentView.sync.never),
    updatedUnknownTime: t(keys.shipmentView.sync.updatedUnknownTime),
    failedUnknownTime: t(keys.shipmentView.sync.failedUnknownTime),
    updated: (relative: string) => t(keys.shipmentView.sync.updated, { relative }),
    failed: (relative: string) => t(keys.shipmentView.sync.failed, { relative }),
  }

  return (
    <div class="flex flex-wrap gap-1 px-2.5 py-1">
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
