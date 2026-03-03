import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { toContainerEtaChipLabel } from '~/modules/process/ui/utils/eta-labels'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { CopyButton } from '~/shared/ui/CopyButton'

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
}

function ContainerSelectorItem(props: {
  readonly container: ContainerDetailVM
  readonly selected: boolean
  readonly onSelect: (id: string) => void
  readonly labels: ContainerSelectorItemLabels
}): JSX.Element {
  return (
    <div
      data-testid={`container-card-${props.container.id}`}
      class={`flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors ${
        props.selected
          ? 'border-slate-600 bg-slate-700 text-white'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <button
        type="button"
        onClick={() => props.onSelect(props.container.id)}
        class="flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-left"
      >
        <span class="font-semibold tracking-wide text-[11px] leading-tight">
          {props.container.number}
        </span>
        <span
          data-testid={`container-eta-chip-${props.container.id}`}
          class={`inline-flex rounded px-1 py-px text-[9px] font-medium leading-none ${etaChipClass(
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
        {props.container.tsChipVm.visible ? (
          <span
            data-testid={`container-int-chip-${props.container.id}`}
            class={`inline-flex rounded px-1 py-px text-[9px] font-medium leading-none ${
              props.selected ? 'bg-slate-600/60 text-slate-200' : 'bg-slate-100 text-slate-400'
            }`}
            title={props.container.tsChipVm.portsTooltip ?? undefined}
          >
            {props.labels.ts(props.container.tsChipVm.count)}
          </span>
        ) : null}
        {props.container.dataIssueChipVm.visible ? (
          <span
            data-testid={`container-data-chip-${props.container.id}`}
            class={`inline-flex rounded px-1 py-px text-[9px] font-medium leading-none ${
              props.selected ? 'bg-slate-600/60 text-slate-200' : 'bg-amber-50 text-amber-600'
            }`}
          >
            {props.labels.dataIssue}
          </span>
        ) : null}
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
}): JSX.Element {
  const { t, keys } = useTranslation()
  const labels: ContainerSelectorItemLabels = {
    etaArrived: t(keys.shipmentView.operational.chips.etaArrived),
    etaExpectedPrefix: t(keys.shipmentView.operational.chips.etaExpected),
    etaDelayed: t(keys.shipmentView.operational.header.selectedExpectedDelayed),
    etaMissing: t(keys.shipmentView.operational.chips.etaMissing),
    ts: (count: number) => t(keys.shipmentView.operational.chips.ts, { count }),
    dataIssue: t(keys.shipmentView.operational.chips.dataIssue),
    copyContainerNumber: t(keys.process.containerSelector.copyContainerNumber),
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
          />
        )}
      </For>
    </div>
  )
}
