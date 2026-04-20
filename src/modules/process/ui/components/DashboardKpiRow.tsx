import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import {
  DashboardKpiCard,
  DashboardKpiCardSkeleton,
} from '~/modules/process/ui/components/DashboardKpiCard'
import type { DashboardKpiVM } from '~/modules/process/ui/viewmodels/dashboard-kpi.vm'

type DashboardKpiRowProps = {
  readonly items: readonly DashboardKpiVM[]
  readonly loading: boolean
  readonly refreshing?: boolean
}

const KPI_SKELETON_KEYS = ['skeleton-1', 'skeleton-2', 'skeleton-3', 'skeleton-4'] as const

export function DashboardKpiRow(props: DashboardKpiRowProps): JSX.Element {
  return (
    <section class="mb-4" aria-busy={props.loading || props.refreshing === true}>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Show
          when={!props.loading}
          fallback={<For each={KPI_SKELETON_KEYS}>{() => <DashboardKpiCardSkeleton />}</For>}
        >
          <For each={props.items}>{(item) => <DashboardKpiCard item={item} />}</For>
        </Show>
      </div>
    </section>
  )
}
