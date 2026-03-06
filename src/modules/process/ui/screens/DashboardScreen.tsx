import { useLocation, useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createMemo, createResource, createSignal, onMount, Show } from 'solid-js'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { CreateProcessDialog } from '~/modules/process/ui/CreateProcessDialog'
import { DashboardMetricsGrid } from '~/modules/process/ui/components/DashboardMetricsGrid'
import { DashboardProcessFiltersBar } from '~/modules/process/ui/components/DashboardProcessFiltersBar'
import { DashboardProcessTable } from '~/modules/process/ui/components/DashboardProcessTable'
import { DashboardRefreshButton } from '~/modules/process/ui/components/DashboardRefreshButton'
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
  deriveDashboardImporterFilterOptions,
  deriveDashboardProviderFilterOptions,
  deriveDashboardStatusFilterOptions,
  filterDashboardProcesses,
  hasActiveDashboardFilters,
  setDashboardImporterFilter,
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
import { useTranslation } from '~/shared/localization/i18n'
import { AppHeader } from '~/shared/ui/AppHeader'
import { ExistingProcessError } from '~/shared/ui/ExistingProcessError'

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
  const filteredProcesses = createMemo(() =>
    filterDashboardProcesses(processes() ?? [], filterSelection()),
  )
  const hasActiveFilters = createMemo(() => hasActiveDashboardFilters(filterSelection()))
  const sortedProcesses = createMemo(() =>
    sortDashboardProcesses(filteredProcesses(), sortSelection()),
  )

  onMount(() => {
    const currentSearchParams = new URLSearchParams(location.search)
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

    setSortSelection(resolvedSortSelection)
    setFilterSelection(resolvedFilterSelection)
    writeDashboardSortToLocalStorage(resolvedSortSelection)
    writeDashboardFiltersToLocalStorage(resolvedFilterSelection)

    const currentQuery = currentSearchParams.toString()
    const nextQuery = nextSearchParams.toString()
    if (nextQuery === currentQuery) {
      return
    }

    const nextPath = nextQuery ? `${location.pathname}?${nextQuery}` : location.pathname
    void navigate(nextPath, { replace: true })
  })

  const persistDashboardFilters = (nextFilterSelection: DashboardFilterSelection) => {
    setFilterSelection(nextFilterSelection)
    writeDashboardFiltersToLocalStorage(nextFilterSelection)

    const nextSearchParams = applyDashboardFiltersToSearchParams(
      new URLSearchParams(location.search),
      nextFilterSelection,
    )
    const nextQuery = nextSearchParams.toString()
    const nextPath = nextQuery ? `${location.pathname}?${nextQuery}` : location.pathname

    void navigate(nextPath, { replace: true })
  }

  const handleCreateProcess = () => {
    setCreateError(null)
    setIsCreateDialogOpen(true)
  }

  const handleDashboardRefresh = async () => {
    await refreshDashboardData({
      refetchProcesses,
      refetchGlobalAlerts,
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
    const nextQuery = nextSearchParams.toString()
    const nextPath = nextQuery ? `${location.pathname}?${nextQuery}` : location.pathname

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

  const createErrorMessage = () => {
    const value = createError()
    if (typeof value === 'string') return value
    return value?.message ?? ''
  }

  const createErrorExisting = () => {
    const value = createError()
    if (typeof value === 'string') return undefined
    return value ?? undefined
  }

  return (
    <div class="min-h-screen bg-slate-50/80">
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
          <h1 class="text-lg font-semibold text-slate-900">{t(keys.dashboard.header.title)}</h1>
          <DashboardRefreshButton onRefresh={handleDashboardRefresh} />
        </section>

        <Show when={props.searchSlot}>
          <div class="mb-4 flex justify-center">{props.searchSlot}</div>
        </Show>

        <Show when={createError()}>
          <ExistingProcessError
            message={createErrorMessage()}
            existing={createErrorExisting()}
            onAcknowledge={() => setCreateError(null)}
          />
        </Show>

        <DashboardMetricsGrid
          summary={globalAlerts() ?? null}
          loading={globalAlerts.loading}
          hasError={Boolean(globalAlerts.error)}
        />
        <DashboardProcessFiltersBar
          providers={providerFilterOptions()}
          statuses={statusFilterOptions()}
          importers={importerFilterOptions()}
          selectedProviders={filterSelection().providers}
          selectedStatuses={filterSelection().statuses}
          selectedImporterId={filterSelection().importerId}
          selectedImporterName={filterSelection().importerName}
          onProviderToggle={handleProviderFilterToggle}
          onStatusToggle={handleStatusFilterToggle}
          onImporterSelect={handleImporterFilterSelect}
          onClearAllFilters={handleClearAllFilters}
        />
        <DashboardProcessTable
          processes={sortedProcesses()}
          loading={processes.loading}
          hasError={Boolean(processes.error)}
          hasActiveFilters={hasActiveFilters()}
          onCreateProcess={handleCreateProcess}
          onClearFilters={handleClearAllFilters}
          sortSelection={sortSelection()}
          onSortToggle={handleSortToggle}
        />
      </main>
    </div>
  )
}
