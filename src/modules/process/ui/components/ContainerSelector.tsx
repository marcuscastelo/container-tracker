import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { computeRowDistribution } from '~/modules/process/ui/components/container-distribution'
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
  readonly etaLabel: string
}

// computeRowDistribution is implemented in a small separate module so it can be
// unit-tested without pulling client-only UI dependencies.

function ContainerSelectorItem(props: {
  readonly container: ContainerDetailVM
  readonly selected: boolean
  readonly onSelect: (id: string) => void
  readonly labels: ContainerSelectorItemLabels
  readonly statusLabel: string
}): JSX.Element {
  const etaValue = () =>
    toContainerEtaChipLabel(props.container.etaChipVm, {
      arrived: props.labels.etaArrived,
      expectedPrefix: props.labels.etaExpectedPrefix,
      delayed: props.labels.etaDelayed,
      missing: props.labels.etaMissing,
    })

  const cardClass = () => {
    if (props.selected) {
      return 'border-primary bg-secondary shadow-[0_1px_2px_rgba(44,47,89,0.18)] ring-1 ring-border'
    }
    return 'border-border bg-surface hover:border-border-strong hover:bg-surface-muted'
  }

  return (
    <button
      type="button"
      data-testid={`container-card-${props.container.id}`}
      onClick={() => props.onSelect(props.container.id)}
      class={`w-full rounded-lg border p-3 text-left transition-colors ${cardClass()}`}
    >
      {/* Row 1 — container number */}
      <div class="truncate font-mono text-sm-ui font-semibold tracking-wide text-foreground">
        {props.container.number}
      </div>

      {/* Row 2 — ETA */}
      <div class="mt-2 flex items-center gap-1 text-xs-ui text-text-muted">
        <svg
          class="h-3 w-3 shrink-0"
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
        <span class="font-medium">{props.labels.etaLabel}:</span>
        <span class="truncate">{etaValue()}</span>
      </div>

      {/* Row 3 — status + data-issue badge */}
      <div class="mt-2 flex items-center gap-2">
        <StatusBadge variant={props.container.status} label={props.statusLabel} size="micro" />
        <Show when={props.container.dataIssueChipVm.visible}>
          <span class="inline-flex rounded-md border border-tone-warning-border bg-tone-warning-bg px-1.5 py-0.5 text-micro font-medium text-tone-warning-fg">
            {props.labels.dataIssue}
          </span>
        </Show>
      </div>
    </button>
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
    dataIssue: t(keys.shipmentView.operational.chips.dataIssue),
    etaLabel: t(keys.shipmentView.currentStatus.eta),
  }

  // Slice containers into rows according to the distribution algorithm.
  const rows = createMemo<ContainerDetailVM[][]>(() => {
    const dist = computeRowDistribution(props.containers.length)
    const result: ContainerDetailVM[][] = []
    let idx = 0
    for (const count of dist) {
      const row = props.containers.slice(idx, idx + count)
      result.push(row)
      idx += count
    }
    return result
  })

  return (
    <div class="space-y-3 px-3 py-3">
      <For each={rows()}>
        {(row) => (
          <div class="flex gap-3">
            <For each={row}>
              {(container) => (
                <div class="min-w-0 flex-1">
                  <ContainerSelectorItem
                    container={container}
                    selected={String(props.selectedId) === String(container.id)}
                    onSelect={props.onSelect}
                    labels={labels}
                    statusLabel={t(trackingStatusToLabelKey(keys, container.statusCode))}
                  />
                </div>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  )
}
