import { useLocation, useNavigate, usePreloadRoute } from '@solidjs/router'
import { Check, CircleAlert, RefreshCw, TriangleAlert } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createMemo, createResource, createSignal, onCleanup, onMount, Show } from 'solid-js'
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
import { navigateToProcess, prefetchProcessIntent } from '~/shared/ui/navigation/app-navigation'

const DASHBOARD_CHART_TABLET_MIN_WIDTH = 768
const DASHBOARD_CHART_DESKTOP_MIN_WIDTH = 1280

function resolveDashboardChartWindowSize(viewportWidth: number): DashboardChartWindowSize {
  if (viewportWidth >= DASHBOARD_CHART_DESKTOP_MIN_WIDTH) {
    return 24
  }

  if (viewportWidth >= DASHBOARD_CHART_TABLET_MIN_WIDTH) {
    return 12
  }

  return 6
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
  const [_, { refetch: refetchGlobalAlerts }] = createResource(() => {
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
    createSignal<DashboardChartWindowSize>(
      (() => {
        if (typeof window === 'undefined') return 6
        return resolveDashboardChartWindowSize(window.innerWidth)
      })(),
    )
  const [dashboardProcessesCreatedByMonth, { refetch: refetchDashboardProcessesCreatedByMonth }] =
    createResource(dashboardChartWindowSize, (windowSize) =>
      fetchDashboardProcessesCreatedByMonth({ windowSize }),
    )
  const {
    sortSelection,
    filterSelection,
    handleSortToggle,
    handleProviderFilterToggle,
    handleStatusFilterToggle,
    handleImporterFilterSelect,
    handleSeverityFilterSelect,
    handleClearAllFilters,
  } = useDashboardFilterSortController({
    pathname: () => location.pathname,
    search: () => location.search,
    navigate,
  })
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
  const { processesWithSyncFeedback, handleDashboardRefresh, handleProcessSync } =
    useDashboardSyncController({
      allProcesses: () => processes() ?? [],
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
    prefetchProcessIntent({
      processId,
      preloadRoute,
      preloadData: () => prefetchProcessDetail(processId, locale()),
    })
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
            processes={processesWithSyncFeedback()}
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
