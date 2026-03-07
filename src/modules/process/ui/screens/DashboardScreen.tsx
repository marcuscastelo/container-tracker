import { useLocation, useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createMemo, createResource, createSignal, onMount, Show } from 'solid-js'
import {
  syncAllProcessesRequest,
  syncProcessRequest,
} from '~/modules/process/ui/api/processSync.api'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { CreateProcessDialog } from '~/modules/process/ui/CreateProcessDialog'
import { DashboardMetricsGrid } from '~/modules/process/ui/components/DashboardMetricsGrid'
import { DashboardProcessTable } from '~/modules/process/ui/components/DashboardProcessTable'
import { DashboardRefreshButton } from '~/modules/process/ui/components/DashboardRefreshButton'
import { UnifiedDashboardFilters } from '~/modules/process/ui/components/UnifiedDashboardFilters'
import { useProcessSyncRealtime } from '~/modules/process/ui/hooks/useProcessSyncRealtime'
import { emitDashboardSortChangedTelemetry } from '~/modules/process/ui/telemetry/dashboardSort.telemetry'
import { refreshDashboardData } from '~/modules/process/ui/utils/dashboard-refresh'
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
} from '~/modules/process/ui/viewmodels/dashboard-filter-interaction.vm'
import type {
  DashboardSortField,
  DashboardSortSelection,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import {
  nextDashboardSortSelection,
  sortDashboardProcesses,
} from '~/modules/process/ui/viewmodels/dashboard-sort-interaction.vm'
import type { TrackingStatusCode } from '~/modules/tracking/application/projection/tracking.status.projection'
import { BRANDING } from '~/shared/config/branding'
import { useTranslation } from '~/shared/localization/i18n'
import { AppHeader } from '~/shared/ui/AppHeader'
import { ExistingProcessError } from '~/shared/ui/ExistingProcessError'

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

// eslint-disable-next-line max-lines-per-function
export function Dashboard(props: { readonly searchSlot?: JSX.Element }): JSX.Element {
  const { t, keys } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [processes, { refetch: refetchProcesses }] = createResource(() =>
    fetchDashboardProcessSummaries(),
  )
  const [globalAlerts, { refetch: refetchGlobalAlerts }] = createResource(() =>
    fetchDashboardGlobalAlertsSummary(),
  )
  const [sortSelection, setSortSelection] = createSignal<DashboardSortSelection>(
    parseDashboardSortFromSearchParams(new URLSearchParams(location.search)),
  )
  const [filterSelection, setFilterSelection] = createSignal<DashboardFilterSelection>(
    parseDashboardFiltersFromSearchParams(new URLSearchParams(location.search)),
  )
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false)
  const [createError, setCreateError] = createSignal<string | ExistingProcessConflict | null>(null)

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
  const filteredProcesses = createMemo(() =>
    filterDashboardProcesses(processes() ?? [], filterSelection()),
  )
  const hasActiveFilters = createMemo(() => hasActiveDashboardFilters(filterSelection()))
  const sortedProcesses = createMemo(() =>
    sortDashboardProcesses(filteredProcesses(), sortSelection()),
  )
  const realtimeSyncStateByProcessId = useProcessSyncRealtime({
    processes: () => processes() ?? [],
  })
  const sortedProcessesWithRealtimeSync = createMemo(() => {
    const stateByProcessId = realtimeSyncStateByProcessId()
    return sortedProcesses().map((process) => {
      const realtimeState = stateByProcessId[process.id]
      if (!realtimeState) return process
      return {
        ...process,
        syncStatus: realtimeState,
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
    await refreshDashboardData({
      syncAllProcesses: syncAllProcessesRequest,
      refetchProcesses,
      refetchGlobalAlerts,
    })
  }

  const handleProcessSync = async (processId: string) => {
    await syncProcessRequest(processId)
    await refetchProcesses()
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

  const handleStatusFilterToggle = (status: TrackingStatusCode) => {
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

      navigate(`/shipments/${processId}`)
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
    <div class="relative min-h-screen bg-slate-50/80">
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
        />
        <CreateProcessDialog
          open={isCreateDialogOpen()}
          onClose={() => setIsCreateDialogOpen(false)}
          onSubmit={handleProcessSubmit}
        />

        <main class="mx-auto max-w-7xl px-4 py-4 lg:px-6">
          <section class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-lg-ui font-semibold text-slate-900">
              {t(keys.dashboard.header.title)}
            </h1>
            <DashboardRefreshButton onRefresh={handleDashboardRefresh} />
          </section>

          <Show when={props.searchSlot}>
            <div class="mb-4 flex justify-center">{props.searchSlot}</div>
          </Show>

          <Show when={createError()}>
            <ExistingProcessError
              message={getCreateErrorMessage(createError())}
              existing={getCreateErrorExisting(createError())}
              onAcknowledge={() => setCreateError(null)}
            />
          </Show>

          <DashboardMetricsGrid
            summary={globalAlerts() ?? null}
            loading={globalAlerts.loading}
            hasError={Boolean(globalAlerts.error)}
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
          />
        </main>
      </div>
    </div>
  )
}
