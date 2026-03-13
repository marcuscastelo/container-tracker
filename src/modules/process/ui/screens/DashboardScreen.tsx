import { useLocation, useNavigate, usePreloadRoute } from '@solidjs/router'
import { Check, CircleAlert, RefreshCw, TriangleAlert } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createMemo, createResource, createSignal, onCleanup, onMount, Show } from 'solid-js'
import {
  syncAllProcessesRequest,
  syncProcessRequest,
} from '~/modules/process/ui/api/processSync.api'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { CreateProcessDialog } from '~/modules/process/ui/CreateProcessDialog'
import { DashboardActivityChartCard } from '~/modules/process/ui/components/DashboardActivityChartCard'
import { DashboardKpiRow } from '~/modules/process/ui/components/DashboardKpiRow'
import { DashboardProcessTable } from '~/modules/process/ui/components/DashboardProcessTable'
import { DashboardRefreshButton } from '~/modules/process/ui/components/DashboardRefreshButton'
import { UnifiedDashboardFilters } from '~/modules/process/ui/components/UnifiedDashboardFilters'
import { fetchDashboardKpis } from '~/modules/process/ui/fetchDashboardKpis'
import {
  type DashboardChartWindowSize,
  fetchDashboardProcessesCreatedByMonth,
} from '~/modules/process/ui/fetchDashboardProcessesCreatedByMonth'
import { prefetchProcessDetail } from '~/modules/process/ui/fetchProcess'
import { useProcessSyncRealtime } from '~/modules/process/ui/hooks/useProcessSyncRealtime'
import { toDashboardKpiVMs } from '~/modules/process/ui/mappers/dashboard-kpis.ui-mapper'
import { toDashboardMonthlyBarDatumVMs } from '~/modules/process/ui/mappers/dashboard-processes-created-by-month.ui-mapper'
import type { ProcessStatusCode } from '~/modules/process/ui/process-status-color'
import { emitDashboardSortChangedTelemetry } from '~/modules/process/ui/telemetry/dashboardSort.telemetry'
import { refreshDashboardData } from '~/modules/process/ui/utils/dashboard-refresh'
import {
  type DashboardLocalSyncStatus,
  resolveDashboardProcessSyncStatus,
} from '~/modules/process/ui/utils/dashboard-sync-reconciliation'
import {
  applyDashboardFiltersToSearchParams,
  hydrateDashboardFiltersFromQueryAndStorage,
  parseDashboardFiltersFromSearchParams,
} from '~/modules/process/ui/validation/dashboardFilterQuery.validation'
import {
  readDashboardFiltersFromLocalStorage,
  writeDashboardFiltersToLocalStorage,
} from '~/modules/process/ui/validation/dashboardFilterStorage.validation'
import {
  applyDashboardSortToSearchParams,
  hydrateDashboardSortFromQueryAndStorage,
  parseDashboardSortFromSearchParams,
} from '~/modules/process/ui/validation/dashboardSortQuery.validation'
import {
  readDashboardSortFromLocalStorage,
  writeDashboardSortToLocalStorage,
} from '~/modules/process/ui/validation/dashboardSortStorage.validation'
import {
  createProcessRequest,
  fetchDashboardGlobalAlertsSummary,
  fetchDashboardProcessSummaries,
  toCreateProcessInput,
} from '~/modules/process/ui/validation/processApi.validation'
import {
  type ExistingProcessConflict,
  parseExistingProcessConflictError,
} from '~/modules/process/ui/validation/processConflict.validation'
import {
  DASHBOARD_DEFAULT_FILTER_SELECTION,
  type DashboardFilterSelection,
  type DashboardImporterFilterValue,
  type DashboardSeverityFilterValue,
  deriveDashboardImporterFilterOptions,
  deriveDashboardProviderFilterOptions,
  deriveDashboardSeverityFilterOptions,
  deriveDashboardStatusFilterOptions,
  filterDashboardProcesses,
  hasActiveDashboardFilters,
  setDashboardImporterFilter,
  setDashboardSeverityFilter,
  toggleDashboardProviderFilter,
  toggleDashboardStatusFilter,
} from '~/modules/process/ui/viewmodels/dashboard-filter.service'
import {
  nextDashboardSortSelection,
  sortDashboardProcesses,
} from '~/modules/process/ui/viewmodels/dashboard-sort.service'
import type {
  DashboardSortField,
  DashboardSortSelection,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import { BRANDING } from '~/shared/config/branding'
import { useTranslation } from '~/shared/localization/i18n'
import { AppHeader } from '~/shared/ui/AppHeader'
import { ExistingProcessError } from '~/shared/ui/ExistingProcessError'
import { navigateToProcess, prefetchProcessIntent } from '~/shared/ui/navigation/app-navigation'

const LOCAL_SYNC_FEEDBACK_TTL_MS = 3_000
// Debounce for realtime reconciliation is handled in the realtime hook; avoid
// stacking multiple debounce layers in the screen.
const REALTIME_RECONCILIATION_DEBOUNCE_MS = 0
const DASHBOARD_CHART_TABLET_MIN_WIDTH = 768
const DASHBOARD_CHART_DESKTOP_MIN_WIDTH = 1280

type LocalSyncStateByProcessId = Readonly<Record<string, DashboardLocalSyncStatus>>

function resolveDashboardChartWindowSize(viewportWidth: number): DashboardChartWindowSize {
  if (viewportWidth >= DASHBOARD_CHART_DESKTOP_MIN_WIDTH) {
    return 24
  }

  if (viewportWidth >= DASHBOARD_CHART_TABLET_MIN_WIDTH) {
    return 12
  }

  return 6
}

function toPathWithSearch(pathname: string, searchParams: URLSearchParams): string {
  const nextQuery = searchParams.toString()
  return nextQuery ? `${pathname}?${nextQuery}` : pathname
}

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

function hydrateDashboardQueryState(params: {
  readonly currentSearch: string
  readonly pathname: string
  readonly navigate: ReturnType<typeof useNavigate>
  readonly setSortSelection: (selection: DashboardSortSelection) => void
  readonly setFilterSelection: (selection: DashboardFilterSelection) => void
}): void {
  const currentSearchParams = new URLSearchParams(params.currentSearch)
  const hydratedSort = hydrateDashboardSortFromQueryAndStorage(
    currentSearchParams,
    readDashboardSortFromLocalStorage(),
  )
  const hydratedFilters = hydrateDashboardFiltersFromQueryAndStorage(
    hydratedSort.searchParams,
    readDashboardFiltersFromLocalStorage(),
  )
  const resolvedSortSelection = hydratedSort.sortSelection
  const resolvedFilterSelection = hydratedFilters.filterSelection
  const nextSearchParams = hydratedFilters.searchParams

  params.setSortSelection(resolvedSortSelection)
  params.setFilterSelection(resolvedFilterSelection)
  writeDashboardSortToLocalStorage(resolvedSortSelection)
  writeDashboardFiltersToLocalStorage(resolvedFilterSelection)

  const nextPath = toPathWithSearch(params.pathname, nextSearchParams)
  const currentPath = toPathWithSearch(params.pathname, currentSearchParams)
  if (nextPath === currentPath) {
    return
  }

  void params.navigate(nextPath, { replace: true })
}

function withProcessLocalSyncState(
  previous: LocalSyncStateByProcessId,
  processId: string,
  syncStatus: DashboardLocalSyncStatus,
): LocalSyncStateByProcessId {
  return {
    ...previous,
    [processId]: syncStatus,
  }
}

function withManyProcessLocalSyncStates(
  previous: LocalSyncStateByProcessId,
  processIds: readonly string[],
  syncStatus: DashboardLocalSyncStatus,
): LocalSyncStateByProcessId {
  if (processIds.length === 0) return previous
  const next: Record<string, DashboardLocalSyncStatus> = { ...previous }
  for (const processId of processIds) {
    next[processId] = syncStatus
  }
  return next
}

function withoutProcessLocalSyncState(
  previous: LocalSyncStateByProcessId,
  processId: string,
): LocalSyncStateByProcessId {
  if (previous[processId] === undefined) return previous
  const next: Record<string, DashboardLocalSyncStatus> = { ...previous }
  delete next[processId]
  return next
}

// eslint-disable-next-line max-lines-per-function
export function Dashboard(props: { readonly searchSlot?: JSX.Element }): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const preloadRoute = usePreloadRoute()
  let shouldPreferPrefetchedProcesses = true
  let shouldPreferPrefetchedGlobalAlerts = true
  const [processes, { refetch: refetchProcesses }] = createResource(() => {
    const preferPrefetched = shouldPreferPrefetchedProcesses
    shouldPreferPrefetchedProcesses = false
    return fetchDashboardProcessSummaries(undefined, {
      preferPrefetched,
    })
  })
  const [globalAlerts, { refetch: refetchGlobalAlerts }] = createResource(() => {
    const preferPrefetched = shouldPreferPrefetchedGlobalAlerts
    shouldPreferPrefetchedGlobalAlerts = false
    return fetchDashboardGlobalAlertsSummary({
      preferPrefetched,
    })
  })
  const [dashboardKpis, { refetch: refetchDashboardKpis }] = createResource(() =>
    fetchDashboardKpis(),
  )
  const [dashboardChartWindowSize, setDashboardChartWindowSize] =
    createSignal<DashboardChartWindowSize>(6)
  const [dashboardProcessesCreatedByMonth, { refetch: refetchDashboardProcessesCreatedByMonth }] =
    createResource(dashboardChartWindowSize, (windowSize) =>
      fetchDashboardProcessesCreatedByMonth({ windowSize }),
    )
  const [sortSelection, setSortSelection] = createSignal<DashboardSortSelection>(
    parseDashboardSortFromSearchParams(new URLSearchParams(location.search)),
  )
  const [filterSelection, setFilterSelection] = createSignal<DashboardFilterSelection>(
    parseDashboardFiltersFromSearchParams(new URLSearchParams(location.search)),
  )
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false)
  const [createError, setCreateError] = createSignal<string | ExistingProcessConflict | null>(null)
  const [localSyncStateByProcessId, setLocalSyncStateByProcessId] =
    createSignal<LocalSyncStateByProcessId>({})

  const localSyncFeedbackTimeoutByProcessId = new Map<string, ReturnType<typeof setTimeout>>()
  let realtimeReconciliationTimeoutId: ReturnType<typeof setTimeout> | null = null
  let realtimeReconciliationInFlight = false
  let pendingRealtimeReconciliation = false

  const clearLocalSyncFeedbackTimer = (processId: string): void => {
    const timeoutId = localSyncFeedbackTimeoutByProcessId.get(processId)
    if (timeoutId === undefined) return
    clearTimeout(timeoutId)
    localSyncFeedbackTimeoutByProcessId.delete(processId)
  }

  const clearLocalSyncState = (processId: string): void => {
    clearLocalSyncFeedbackTimer(processId)
    setLocalSyncStateByProcessId((previous) => withoutProcessLocalSyncState(previous, processId))
  }

  const setLocalSyncState = (
    processId: string,
    syncStatus: DashboardLocalSyncStatus,
    options?: { readonly ttlMs?: number },
  ): void => {
    clearLocalSyncFeedbackTimer(processId)
    setLocalSyncStateByProcessId((previous) =>
      withProcessLocalSyncState(previous, processId, syncStatus),
    )

    if (options?.ttlMs === undefined) return
    const timeoutId = setTimeout(() => {
      clearLocalSyncState(processId)
    }, options.ttlMs)
    localSyncFeedbackTimeoutByProcessId.set(processId, timeoutId)
  }

  const setLocalSyncStates = (
    processIds: readonly string[],
    syncStatus: DashboardLocalSyncStatus,
    options?: { readonly ttlMs?: number },
  ): void => {
    if (processIds.length === 0) return

    for (const processId of processIds) {
      clearLocalSyncFeedbackTimer(processId)
    }

    setLocalSyncStateByProcessId((previous) =>
      withManyProcessLocalSyncStates(previous, processIds, syncStatus),
    )

    if (options?.ttlMs === undefined) return

    // Use a single shared timeout to clear many local sync feedback entries at
    // once instead of creating one timer per row. This reduces pressure when the
    // dashboard contains many processes.
    const timeoutId = setTimeout(() => {
      for (const processId of processIds) {
        clearLocalSyncState(processId)
      }
    }, options.ttlMs)

    for (const processId of processIds) {
      localSyncFeedbackTimeoutByProcessId.set(processId, timeoutId)
    }
  }

  const clearRealtimeReconciliationTimer = (): void => {
    if (realtimeReconciliationTimeoutId === null) return
    clearTimeout(realtimeReconciliationTimeoutId)
    realtimeReconciliationTimeoutId = null
  }

  const reconcileProcessesFromServerSnapshot = async (): Promise<void> => {
    if (realtimeReconciliationInFlight) {
      // Mark that a reconciliation was requested while a refetch was already in
      // flight so we perform one additional refetch when the current one ends.
      pendingRealtimeReconciliation = true
      return
    }

    realtimeReconciliationInFlight = true
    try {
      await refetchProcesses()
    } catch (error) {
      console.error('Failed to reconcile dashboard process sync state from realtime:', error)
    } finally {
      realtimeReconciliationInFlight = false
      if (pendingRealtimeReconciliation) {
        // Clear the flag and run a single extra refetch to ensure the UI
        // reflects updates that occurred while the previous request was in-flight.
        pendingRealtimeReconciliation = false
        try {
          await refetchProcesses()
        } catch (err) {
          console.error('Failed to perform pending realtime reconciliation:', err)
        }
      }
    }
  }

  const scheduleRealtimeReconciliation = (): void => {
    clearRealtimeReconciliationTimer()
    realtimeReconciliationTimeoutId = setTimeout(() => {
      realtimeReconciliationTimeoutId = null
      void reconcileProcessesFromServerSnapshot()
    }, REALTIME_RECONCILIATION_DEBOUNCE_MS)
  }

  onCleanup(() => {
    clearRealtimeReconciliationTimer()
    for (const timeoutId of localSyncFeedbackTimeoutByProcessId.values()) {
      clearTimeout(timeoutId)
    }
    localSyncFeedbackTimeoutByProcessId.clear()
  })

  const providerFilterOptions = createMemo(() =>
    deriveDashboardProviderFilterOptions(processes() ?? []),
  )
  const importerFilterOptions = createMemo(() =>
    deriveDashboardImporterFilterOptions(processes() ?? []),
  )
  const statusFilterOptions = createMemo(() =>
    deriveDashboardStatusFilterOptions(processes() ?? []),
  )
  const severityFilterOptions = createMemo(() =>
    deriveDashboardSeverityFilterOptions(processes() ?? []),
  )
  const dashboardKpiItems = createMemo(() => {
    const source = dashboardKpis()
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
    const source = dashboardProcessesCreatedByMonth()
    if (!source) return []
    return toDashboardMonthlyBarDatumVMs(source, locale())
  })
  const filteredProcesses = createMemo(() =>
    filterDashboardProcesses(processes() ?? [], filterSelection()),
  )
  const hasActiveFilters = createMemo(() => hasActiveDashboardFilters(filterSelection()))
  const sortedProcesses = createMemo(() =>
    sortDashboardProcesses(filteredProcesses(), sortSelection()),
  )
  const realtimeSyncStateByProcessId = useProcessSyncRealtime({
    processes: () => processes() ?? [],
    onRealtimeStateChanged: scheduleRealtimeReconciliation,
  })
  const sortedProcessesWithRealtimeSync = createMemo(() => {
    const realtimeStateByProcessId = realtimeSyncStateByProcessId()
    const localStateByProcessId = localSyncStateByProcessId()

    return sortedProcesses().map((process) => {
      const resolvedSyncState = resolveDashboardProcessSyncStatus({
        serverSnapshotState: process.syncStatus,
        realtimeState: realtimeStateByProcessId[process.id] === 'syncing' ? 'syncing' : null,
        localState: localStateByProcessId[process.id] ?? null,
      })

      if (resolvedSyncState === process.syncStatus) return process

      return {
        ...process,
        syncStatus: resolvedSyncState,
      }
    })
  })

  onMount(() => {
    hydrateDashboardQueryState({
      currentSearch: location.search,
      pathname: location.pathname,
      navigate,
      setSortSelection,
      setFilterSelection,
    })

    const updateChartWindowSize = (): void => {
      setDashboardChartWindowSize(resolveDashboardChartWindowSize(window.innerWidth))
    }

    updateChartWindowSize()
    window.addEventListener('resize', updateChartWindowSize)
    onCleanup(() => {
      window.removeEventListener('resize', updateChartWindowSize)
    })
  })

  const persistDashboardFilters = (nextFilterSelection: DashboardFilterSelection) => {
    setFilterSelection(nextFilterSelection)
    writeDashboardFiltersToLocalStorage(nextFilterSelection)

    const nextSearchParams = applyDashboardFiltersToSearchParams(
      new URLSearchParams(location.search),
      nextFilterSelection,
    )
    const nextPath = toPathWithSearch(location.pathname, nextSearchParams)

    void navigate(nextPath, { replace: true })
  }

  const handleCreateProcess = () => {
    setCreateError(null)
    setIsCreateDialogOpen(true)
  }

  const handleDashboardRefresh = async () => {
    const currentProcessIds = (processes() ?? []).map((process) => process.id)
    setLocalSyncStates(currentProcessIds, 'syncing')

    try {
      await refreshDashboardData({
        syncAllProcesses: syncAllProcessesRequest,
        refetchProcesses,
        refetchGlobalAlerts,
        refetchDashboardKpis,
        refetchDashboardProcessesCreatedByMonth,
      })

      setLocalSyncStates(currentProcessIds, 'success', {
        ttlMs: LOCAL_SYNC_FEEDBACK_TTL_MS,
      })
    } catch (error) {
      setLocalSyncStates(currentProcessIds, 'error', {
        ttlMs: LOCAL_SYNC_FEEDBACK_TTL_MS,
      })
      throw error
    }
  }

  const handleProcessSync = async (processId: string) => {
    const currentLocalState = localSyncStateByProcessId()[processId]
    if (currentLocalState === 'syncing') return

    setLocalSyncState(processId, 'syncing')

    try {
      await syncProcessRequest(processId)
      await refetchProcesses()
      setLocalSyncState(processId, 'success', {
        ttlMs: LOCAL_SYNC_FEEDBACK_TTL_MS,
      })
    } catch (error) {
      console.error(`Dashboard process sync failed for ${processId}:`, error)
      await Promise.resolve(refetchProcesses()).catch((refetchError: unknown) => {
        console.error(
          `Failed to reconcile dashboard process row after sync failure for ${processId}:`,
          refetchError,
        )
      })
      setLocalSyncState(processId, 'error', {
        ttlMs: LOCAL_SYNC_FEEDBACK_TTL_MS,
      })
    }
  }

  const handleOpenProcess = (processId: string) => {
    navigateToProcess({
      navigate,
      processId,
    })
  }

  const handleProcessIntent = (processId: string) => {
    prefetchProcessIntent({
      processId,
      preloadRoute,
      preloadData: () => prefetchProcessDetail(processId, locale()),
    })
  }

  const handleSortToggle = (field: DashboardSortField) => {
    const nextSelection = nextDashboardSortSelection(sortSelection(), field)
    setSortSelection(nextSelection)
    emitDashboardSortChangedTelemetry('user', field, nextSelection)
    writeDashboardSortToLocalStorage(nextSelection)

    const nextSearchParams = applyDashboardSortToSearchParams(
      new URLSearchParams(location.search),
      nextSelection,
    )
    const nextPath = toPathWithSearch(location.pathname, nextSearchParams)

    void navigate(nextPath, { replace: true })
  }

  const handleProviderFilterToggle = (provider: string) => {
    persistDashboardFilters(toggleDashboardProviderFilter(filterSelection(), provider))
  }

  const handleStatusFilterToggle = (status: ProcessStatusCode) => {
    persistDashboardFilters(toggleDashboardStatusFilter(filterSelection(), status))
  }

  const handleImporterFilterSelect = (importer: DashboardImporterFilterValue | null) => {
    persistDashboardFilters(setDashboardImporterFilter(filterSelection(), importer))
  }

  const handleSeverityFilterSelect = (severity: DashboardSeverityFilterValue | null) => {
    persistDashboardFilters(setDashboardSeverityFilter(filterSelection(), severity))
  }

  const handleClearAllFilters = () => {
    persistDashboardFilters(DASHBOARD_DEFAULT_FILTER_SELECTION)
  }

  const handleProcessSubmit = async (data: CreateProcessDialogFormData) => {
    try {
      setCreateError(null)

      const processId = await createProcessRequest(toCreateProcessInput(data))

      await Promise.all([refetchProcesses(), refetchGlobalAlerts()])

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
          alertCount={globalAlerts()?.totalActiveAlerts ?? 0}
          searchSlot={props.searchSlot}
          syncSlot={<DashboardRefreshButton onRefresh={handleDashboardRefresh} />}
        />
        <CreateProcessDialog
          open={isCreateDialogOpen()}
          onClose={() => setIsCreateDialogOpen(false)}
          onSubmit={handleProcessSubmit}
        />

        <main class="relative mx-auto max-w-[var(--dashboard-container-max-width)] px-[var(--dashboard-container-px)] py-[var(--dashboard-container-py)]">
          <Show when={createError()}>
            <ExistingProcessError
              message={getCreateErrorMessage(createError())}
              existing={getCreateErrorExisting(createError())}
              onAcknowledge={() => setCreateError(null)}
            />
          </Show>

          <DashboardKpiRow items={dashboardKpiItems()} loading={dashboardKpis.loading} />
          <DashboardActivityChartCard
            data={dashboardMonthlyBarData()}
            loading={dashboardProcessesCreatedByMonth.loading}
            hasError={Boolean(dashboardProcessesCreatedByMonth.error)}
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
            processes={sortedProcessesWithRealtimeSync()}
            loading={processes.loading}
            hasError={Boolean(processes.error)}
            hasActiveFilters={hasActiveFilters()}
            onCreateProcess={handleCreateProcess}
            onClearFilters={handleClearAllFilters}
            sortSelection={sortSelection()}
            onSortToggle={handleSortToggle}
            onProcessSync={handleProcessSync}
            onOpenProcess={handleOpenProcess}
            onProcessIntent={handleProcessIntent}
          />
        </main>
      </div>
    </div>
  )
}
