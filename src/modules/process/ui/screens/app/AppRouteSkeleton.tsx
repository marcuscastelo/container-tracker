import type { Accessor, JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { DashboardActivityChartCard } from '~/modules/process/ui/components/DashboardActivityChartCard'
import { DashboardKpiRow } from '~/modules/process/ui/components/DashboardKpiRow'
import { DashboardProcessTable } from '~/modules/process/ui/components/DashboardProcessTable'
import { ShipmentScreenSkeleton } from '~/modules/process/ui/screens/shipment/components/ShipmentScreenSkeleton'
import { resolveDashboardChartWindowSize } from '~/modules/process/ui/utils/dashboard-chart-window-size'
import { AppHeader } from '~/shared/ui/AppHeader'

type AppRouteSkeletonProps = {
  readonly pathname: Accessor<string>
}

const DASHBOARD_FILTER_SKELETON_KEYS = [
  'dashboard-filter-skeleton-1',
  'dashboard-filter-skeleton-2',
  'dashboard-filter-skeleton-3',
  'dashboard-filter-skeleton-4',
] as const

const noop = () => undefined
const noopAsync = () => Promise.resolve()

function HeaderSearchSkeleton(): JSX.Element {
  return (
    <div
      class="dashboard-skeleton-shimmer h-[var(--dashboard-search-height)] min-h-[var(--dashboard-search-height)] rounded-[var(--dashboard-control-radius)] border border-border bg-surface-muted"
      aria-hidden="true"
    />
  )
}

function HeaderActionSkeleton(): JSX.Element {
  return (
    <div
      class="dashboard-skeleton-shimmer h-[var(--dashboard-control-height)] w-28 rounded-[var(--dashboard-control-radius)] border border-border bg-surface-muted"
      aria-hidden="true"
    />
  )
}

function DashboardFiltersSkeleton(): JSX.Element {
  return (
    <div class="mb-3 flex flex-wrap gap-2" aria-hidden="true">
      <For each={DASHBOARD_FILTER_SKELETON_KEYS}>
        {(key) => (
          <div
            data-key={key}
            class="dashboard-skeleton-shimmer h-9 w-28 rounded-[var(--dashboard-control-radius)] border border-border bg-surface-muted"
          />
        )}
      </For>
    </div>
  )
}

function AppShellFrame(props: { readonly children: JSX.Element }): JSX.Element {
  return (
    <div class="relative min-h-screen overflow-x-hidden bg-background">
      <div class="relative z-10">
        <AppHeader
          onCreateProcess={() => undefined}
          searchSlot={<HeaderSearchSkeleton />}
          syncSlot={<HeaderActionSkeleton />}
        />
        {props.children}
      </div>
    </div>
  )
}

function DashboardRouteSkeleton(): JSX.Element {
  const windowSize = createMemo(() =>
    typeof window === 'undefined' ? 24 : resolveDashboardChartWindowSize(window.innerWidth),
  )

  return (
    <AppShellFrame>
      <main class="relative mx-auto max-w-(--dashboard-container-max-width) px-(--dashboard-container-px) py-(--dashboard-container-py)">
        <DashboardKpiRow items={[]} loading refreshing={false} />
        <DashboardActivityChartCard
          data={[]}
          loading
          refreshing={false}
          hasError={false}
          windowSize={windowSize()}
        />
        <DashboardFiltersSkeleton />
        <DashboardProcessTable
          processes={[]}
          highlightedProcessId={null}
          initialLoading
          refreshing={false}
          hasError={false}
          hasActiveFilters={false}
          onCreateProcess={noop}
          onClearFilters={noop}
          sortSelection={null}
          onSortToggle={noop}
          onProcessSync={noopAsync}
          onOpenProcess={noop}
          onProcessIntent={noop}
        />
      </main>
    </AppShellFrame>
  )
}

function ShipmentRouteSkeleton(): JSX.Element {
  return (
    <AppShellFrame>
      <main class="relative mx-auto max-w-(--dashboard-container-max-width) px-[var(--dashboard-container-px)] pb-[var(--dashboard-container-py)] pt-6">
        <div
          class="dashboard-skeleton-shimmer mb-3 h-5 w-32 rounded bg-surface-muted"
          aria-hidden="true"
        />
        <ShipmentScreenSkeleton />
      </main>
    </AppShellFrame>
  )
}

export function AppRouteSkeleton(props: AppRouteSkeletonProps): JSX.Element {
  const isShipmentRoute = createMemo(() => props.pathname().startsWith('/shipments/'))

  return (
    <Show when={isShipmentRoute()} fallback={<DashboardRouteSkeleton />}>
      <ShipmentRouteSkeleton />
    </Show>
  )
}
