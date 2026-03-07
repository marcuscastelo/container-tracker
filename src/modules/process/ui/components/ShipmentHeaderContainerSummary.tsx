import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { toContainerSummaryRowVMs } from '~/modules/process/ui/mappers/containerSummary.ui-mapper'
import type { ContainerSummaryRowVM } from '~/modules/process/ui/viewmodels/containerSummary.vm'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { StatusBadge } from '~/shared/ui/StatusBadge'

const MAX_VISIBLE_CONTAINERS = 3

type Props = {
  readonly containers: readonly ContainerDetailVM[]
  readonly syncNow: Date
}

function ContainerSummaryRow(props: { readonly row: ContainerSummaryRowVM }): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div
      class="flex items-center gap-3 text-sm-ui"
      data-testid={`container-summary-row-${props.row.containerNumber}`}
    >
      <span class="font-medium text-slate-800">{props.row.containerNumber}</span>
      <StatusBadge variant={props.row.statusVariant} label={props.row.statusLabel} />
      <span class="text-slate-600">{props.row.etaLabel}</span>
      <span class="text-slate-500">
        <Show when={props.row.alertCount > 0}>
          <span data-testid={`container-summary-alert-count-${props.row.containerNumber}`}>
            {t(keys.shipmentView.containerSummary.alertCount, { count: props.row.alertCount })}
          </span>
          <Show when={props.row.updatedAgoLabel}>
            <span class="mx-0.5">·</span>
          </Show>
        </Show>
        <Show when={props.row.updatedAgoLabel}>{(label) => <span>{label()}</span>}</Show>
      </span>
    </div>
  )
}

export function ShipmentHeaderContainerSummary(props: Props): JSX.Element {
  const { t, keys, locale } = useTranslation()

  const rows = createMemo(() =>
    toContainerSummaryRowVMs({
      containers: props.containers,
      now: props.syncNow,
      locale: locale(),
      t,
      keys,
      noEtaLabel: t(keys.shipmentView.operational.header.noEta),
      updatedLabel: (relative: string) => t(keys.shipmentView.sync.updated, { relative }),
    }),
  )

  const visibleRows = createMemo(() => rows().slice(0, MAX_VISIBLE_CONTAINERS))
  const overflowCount = createMemo(() => Math.max(0, rows().length - MAX_VISIBLE_CONTAINERS))

  return (
    <Show when={rows().length > 0}>
      <div class="mt-2 space-y-1" data-testid="container-summary">
        <span class="text-micro font-semibold uppercase tracking-wider text-slate-400">
          {t(keys.shipmentView.containers.title)}
        </span>
        <div class="space-y-0.5">
          <For each={visibleRows()}>{(row) => <ContainerSummaryRow row={row} />}</For>
          <Show when={overflowCount() > 0}>
            <span class="text-sm-ui text-slate-400" data-testid="container-summary-overflow">
              {t(keys.shipmentView.containerSummary.moreContainers, {
                count: overflowCount(),
              })}
            </span>
          </Show>
        </div>
      </div>
    </Show>
  )
}
