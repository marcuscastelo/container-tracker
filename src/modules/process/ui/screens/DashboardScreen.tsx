import { useNavigate, usePreloadRoute } from '@solidjs/router'
import { Check, CircleAlert, RefreshCw, TriangleAlert } from 'lucide-solid'
import type { Accessor, JSX, Resource } from 'solid-js'
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from 'solid-js'
import {
  createProcessRequest,
  fetchDashboardGlobalAlertsSummary,
  fetchDashboardProcessSummaries,
} from '~/modules/process/ui/api/process.api'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { CreateProcessDialog } from '~/modules/process/ui/CreateProcessDialog'
import { DashboardActivityChartCard } from '~/modules/process/ui/components/DashboardActivityChartCard'
import { DashboardKpiRow } from '~/modules/process/ui/components/DashboardKpiRow'
import { DashboardProcessTable } from '~/modules/process/ui/components/DashboardProcessTable'
import { DashboardRefreshButton } from '~/modules/process/ui/components/DashboardRefreshButton'
import { ExportImportActions } from '~/modules/process/ui/components/export-import/ExportImportActions'
import { UnifiedDashboardFilters } from '~/modules/process/ui/components/UnifiedDashboardFilters'
import { fetchDashboardKpis } from '~/modules/process/ui/fetchDashboardKpis'
import {
  type DashboardChartWindowSize,
  fetchDashboardProcessesCreatedByMonth,
} from '~/modules/process/ui/fetchDashboardProcessesCreatedByMonth'
import { prefetchProcessDetail } from '~/modules/process/ui/fetchProcess'
import { toDashboardKpiVMs } from '~/modules/process/ui/mappers/dashboard-kpis.ui-mapper'
import { toDashboardMonthlyBarDatumVMs } from '~/modules/process/ui/mappers/dashboard-processes-created-by-month.ui-mapper'
import { useDashboardFilterSortController } from '~/modules/process/ui/screens/dashboard/hooks/useDashboardFilterSortController'
import { useDashboardSyncController } from '~/modules/process/ui/screens/dashboard/hooks/useDashboardSyncController'
import { resolveDashboardChartWindowSize } from '~/modules/process/ui/utils/dashboard-chart-window-size'
import { toCreateProcessInput } from '~/modules/process/ui/validation/processApi.validation'
import {
  type ExistingProcessConflict,
  parseExistingProcessConflictError,
} from '~/modules/process/ui/validation/processConflict.validation'
import {
  deriveDashboardImporterFilterOptions,
  deriveDashboardProviderFilterOptions,
  deriveDashboardSeverityFilterOptions,
  deriveDashboardStatusFilterOptions,
  filterDashboardProcesses,
  hasActiveDashboardFilters,
} from '~/modules/process/ui/viewmodels/dashboard-filter.service'
import { sortDashboardProcesses } from '~/modules/process/ui/viewmodels/dashboard-sort.service'
import { BRANDING } from '~/shared/config/branding'
import { useTranslation } from '~/shared/localization/i18n'
import { AppHeader } from '~/shared/ui/AppHeader'
import { ExistingProcessError } from '~/shared/ui/ExistingProcessError'
import {
  navigateToProcess,
  scheduleIntentPrefetch,
  scheduleVisiblePrefetch,
} from '~/shared/ui/navigation/app-navigation'

function getCreateErrorMessage(error: string | ExistingProcessConflict | null): string {
  if (typeof error === 'string') return error
  return error?.message ?? ''
}

function getCreateErrorExisting(
  error: string | ExistingProcessConflict | null,
): ExistingProcessConflict | undefined {
  if (typeof error === 'string') return undefined
  return error ?? undefined
}

type DashboardResourceSnapshotState<T> = {
  readonly data: Accessor<T | undefined>
  readonly initialLoading: Accessor<boolean>
  readonly refreshing: Accessor<boolean>
  readonly hasBlockingError: Accessor<boolean>
}

function useDashboardResourceSnapshot<T>(
  resource: Resource<T | undefined>,
): DashboardResourceSnapshotState<T> {
  const [snapshot, setSnapshot] = createSignal<T | undefined>(resource())

  createEffect(() => {
    const value = resource()
    if (value === undefined) return
    setSnapshot(() => value)
  })

  const hasSnapshot = createMemo(() => snapshot() !== undefined)

  return {
    data: () => snapshot(),
    initialLoading: () => resource.loading && !hasSnapshot(),
    refreshing: () => resource.loading && hasSnapshot(),
    hasBlockingError: () => Boolean(resource.error) && !hasSnapshot(),
  }
}

// eslint-disable-next-line max-lines-per-function
export function Dashboard(props: { readonly searchSlot?: JSX.Element }): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const navigate = useNavigate()
  const preloadRoute = usePreloadRoute()
  let shouldPreferPrefetchedProcesses = true
  let shouldPreferPrefetchedGlobalAlerts = true
  let shouldPreferPrefetchedDashboardKpis = true
  let shouldPreferPrefetchedDashboardActivity = true
  const [processes, { refetch: refetchProcesses }] = createResource(() => {
    const preferPrefetched = shouldPreferPrefetchedProcesses
    shouldPreferPrefetchedProcesses = false
    return fetchDashboardProcessSummaries(undefined, {
      preferPrefetched,
    })
  })
  const [_, { refetch: refetchGlobalAlerts }] = createResource(() => {
    const preferPrefetched = shouldPreferPrefetchedGlobalAlerts
    shouldPreferPrefetchedGlobalAlerts = false
    return fetchDashboardGlobalAlertsSummary({
      preferPrefetched,
    })
  })
  const [dashboardKpis, { refetch: refetchDashboardKpis }] = createResource(() => {
    const preferPrefetched = shouldPreferPrefetchedDashboardKpis
    shouldPreferPrefetchedDashboardKpis = false
    return fetchDashboardKpis({
      preferPrefetched,
    })
  })
  const [dashboardChartWindowSize, setDashboardChartWindowSize] =
    createSignal<DashboardChartWindowSize>(
      (() => {
        if (typeof window === 'undefined') return 6
        return resolveDashboardChartWindowSize(window.innerWidth)
      })(),
    )
  const [dashboardProcessesCreatedByMonth, { refetch: refetchDashboardProcessesCreatedByMonth }] =
    createResource(dashboardChartWindowSize, (windowSize) => {
      const preferPrefetched = shouldPreferPrefetchedDashboardActivity
      shouldPreferPrefetchedDashboardActivity = false
      return fetchDashboardProcessesCreatedByMonth(
        { windowSize },
        {
          preferPrefetched,
        },
      )
    })
  const processesState = useDashboardResourceSnapshot(processes)
  const dashboardKpisState = useDashboardResourceSnapshot(dashboardKpis)
  const dashboardActivityState = useDashboardResourceSnapshot(dashboardProcessesCreatedByMonth)
  const {
    sortSelection,
    filterSelection,
    handleSortToggle,
    handleProviderFilterToggle,
    handleStatusFilterToggle,
    handleImporterFilterSelect,
    handleSeverityFilterSelect,
    handleClearAllFilters,
  } = useDashboardFilterSortController()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false)
  const [createError, setCreateError] = createSignal<string | ExistingProcessConflict | null>(null)

  const providerFilterOptions = createMemo(() =>
    deriveDashboardProviderFilterOptions(processesState.data() ?? []),
  )
  const importerFilterOptions = createMemo(() =>
    deriveDashboardImporterFilterOptions(processesState.data() ?? []),
  )
  const statusFilterOptions = createMemo(() =>
    deriveDashboardStatusFilterOptions(processesState.data() ?? []),
  )
  const severityFilterOptions = createMemo(() =>
    deriveDashboardSeverityFilterOptions(processesState.data() ?? []),
  )
  const dashboardKpiItems = createMemo(() => {
    const source = dashboardKpisState.data()
    if (!source) return []

    return toDashboardKpiVMs({
      source,
      locale: locale(),
      labels: {
        activeProcesses: t(keys.dashboard.kpis.activeProcesses),
        trackedContainers: t(keys.dashboard.kpis.trackedContainers),
        processesWithAlerts: t(keys.dashboard.kpis.processesWithAlerts),
        lastSync: t(keys.dashboard.kpis.lastSync),
        lastSyncUnavailable: t(keys.dashboard.kpis.lastSyncUnavailable),
      },
      icons: {
        activeProcesses: CircleAlert,
        trackedContainers: Check,
        processesWithAlerts: TriangleAlert,
        lastSync: RefreshCw,
      },
    })
  })
  const dashboardMonthlyBarData = createMemo(() => {
    const source = dashboardActivityState.data()
    if (!source) return []
    return toDashboardMonthlyBarDatumVMs(source, locale())
  })
  const filteredProcesses = createMemo(() =>
    filterDashboardProcesses(processesState.data() ?? [], filterSelection()),
  )
  const hasActiveFilters = createMemo(() => hasActiveDashboardFilters(filterSelection()))
  const sortedProcesses = createMemo(() =>
    sortDashboardProcesses(filteredProcesses(), sortSelection()),
  )
  const { processesWithSyncFeedback, handleDashboardRefresh, handleProcessSync } =
    useDashboardSyncController({
      allProcesses: () => processesState.data() ?? [],
      sortedProcesses,
      refetchProcesses,
      refetchGlobalAlerts,
      refetchDashboardKpis,
      refetchDashboardProcessesCreatedByMonth,
    })

  onMount(() => {
    const updateChartWindowSize = (): void => {
      setDashboardChartWindowSize(resolveDashboardChartWindowSize(window.innerWidth))
    }

    updateChartWindowSize()
    window.addEventListener('resize', updateChartWindowSize)
    onCleanup(() => {
      window.removeEventListener('resize', updateChartWindowSize)
    })
  })

  const handleCreateProcess = () => {
    setCreateError(null)
    setIsCreateDialogOpen(true)
  }

  const handleOpenProcess = (processId: string) => {
    navigateToProcess({
      navigate,
      processId,
    })
  }

  const handleProcessIntent = (processId: string) => {
    scheduleIntentPrefetch({
      processId,
      preloadRoute,
      preloadData: (prefetchedProcessId) => prefetchProcessDetail(prefetchedProcessId, locale()),
    })
  }

  const handleVisibleProcessPrefetch = (processIds: readonly string[]) => {
    scheduleVisiblePrefetch({
      processIds,
      preloadRoute,
      preloadData: (prefetchedProcessId) => prefetchProcessDetail(prefetchedProcessId, locale()),
    })
  }

  const handleProcessSubmit = async (data: CreateProcessDialogFormData) => {
    try {
      setCreateError(null)

      const processId = await createProcessRequest(toCreateProcessInput(data))

      await Promise.all([
        refetchProcesses(),
        refetchGlobalAlerts(),
        refetchDashboardKpis(),
        refetchDashboardProcessesCreatedByMonth(),
      ])

      setIsCreateDialogOpen(false)

      navigateToProcess({
        navigate,
        processId,
      })
    } catch (err) {
      console.error('Failed to create process:', err)
      const conflict = parseExistingProcessConflictError(err)
      if (conflict) {
        setCreateError(conflict)
        return
      }
      setCreateError(err instanceof Error ? err.message : 'Failed to create process')
    }
  }

  return (
    <div class="relative min-h-screen overflow-x-hidden bg-background">
      {/* Wallpaper watermark — decorative only, does not affect layout */}
      <img
        src={BRANDING.wallpaper}
        alt=""
        aria-hidden="true"
        class="pointer-events-none fixed inset-0 z-0 h-full w-full select-none object-cover opacity-[0.04]"
      />
      <div class="relative z-10">
        <AppHeader
          onCreateProcess={handleCreateProcess}
          searchSlot={props.searchSlot}
          syncSlot={<DashboardRefreshButton onRefresh={handleDashboardRefresh} />}
          actionsSlot={<ExportImportActions processId={null} showImport />}
        />
        <CreateProcessDialog
          open={isCreateDialogOpen()}
          onClose={() => setIsCreateDialogOpen(false)}
          onSubmit={handleProcessSubmit}
        />

        <main class="relative mx-auto max-w-(--dashboard-container-max-width) px-(--dashboard-container-px) py-(--dashboard-container-py)">
          <Show when={createError()}>
            <ExistingProcessError
              message={getCreateErrorMessage(createError())}
              onAcknowledge={() => setCreateError(null)}
              existing={getCreateErrorExisting(createError()) ?? null}
            />
          </Show>

          <DashboardKpiRow
            items={dashboardKpiItems()}
            loading={dashboardKpisState.initialLoading()}
            refreshing={dashboardKpisState.refreshing()}
          />
          <DashboardActivityChartCard
            data={dashboardMonthlyBarData()}
            loading={dashboardActivityState.initialLoading()}
            refreshing={dashboardActivityState.refreshing()}
            hasError={dashboardActivityState.hasBlockingError()}
            windowSize={dashboardChartWindowSize()}
          />
          <UnifiedDashboardFilters
            providers={providerFilterOptions()}
            statuses={statusFilterOptions()}
            importers={importerFilterOptions()}
            severities={severityFilterOptions()}
            selectedProviders={filterSelection().providers}
            selectedStatuses={filterSelection().statuses}
            selectedImporterId={filterSelection().importerId}
            selectedImporterName={filterSelection().importerName}
            selectedSeverity={filterSelection().severity}
            onProviderToggle={handleProviderFilterToggle}
            onStatusToggle={handleStatusFilterToggle}
            onImporterSelect={handleImporterFilterSelect}
            onSeveritySelect={handleSeverityFilterSelect}
            onClearAllFilters={handleClearAllFilters}
          />
          <DashboardProcessTable
            processes={processesWithSyncFeedback()}
            initialLoading={processesState.initialLoading()}
            refreshing={processesState.refreshing()}
            hasError={processesState.hasBlockingError()}
            hasActiveFilters={hasActiveFilters()}
            onCreateProcess={handleCreateProcess}
            onClearFilters={handleClearAllFilters}
            sortSelection={sortSelection()}
            onSortToggle={handleSortToggle}
            onProcessSync={handleProcessSync}
            onOpenProcess={handleOpenProcess}
            onProcessIntent={handleProcessIntent}
            onVisibleProcessesPrefetch={handleVisibleProcessPrefetch}
          />
        </main>
      </div>
    </div>
  )
}
