import { useLocation, useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createMemo, createResource, createSignal, onMount, Show } from 'solid-js'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { CreateProcessDialog } from '~/modules/process/ui/CreateProcessDialog'
import { DashboardMetricsGrid } from '~/modules/process/ui/components/DashboardMetricsGrid'
import { DashboardProcessFiltersBar } from '~/modules/process/ui/components/DashboardProcessFiltersBar'
import { DashboardProcessTable } from '~/modules/process/ui/components/DashboardProcessTable'
import { emitDashboardSortChangedTelemetry } from '~/modules/process/ui/telemetry/dashboardSort.telemetry'
import {
  applyDashboardSortToSearchParams,
  parseDashboardSortFromSearchParams,
  resolveDashboardSortSelectionWithStorageFallback,
} from '~/modules/process/ui/validation/dashboardSortQuery.validation'
import {
  readDashboardSortFromLocalStorage,
  writeDashboardSortToLocalStorage,
} from '~/modules/process/ui/validation/dashboardSortStorage.validation'
import {
  createProcessRequest,
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
  deriveDashboardProviderFilterOptions,
  deriveDashboardStatusFilterOptions,
  filterDashboardProcesses,
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
import { AppHeader } from '~/shared/ui/AppHeader'
import { ExistingProcessError } from '~/shared/ui/ExistingProcessError'

export function Dashboard(props: { readonly searchSlot?: JSX.Element }): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const [processes, { refetch }] = createResource(() => fetchDashboardProcessSummaries())
  const [sortSelection, setSortSelection] = createSignal<DashboardSortSelection>(
    parseDashboardSortFromSearchParams(new URLSearchParams(location.search)),
  )
  const [filterSelection, setFilterSelection] = createSignal<DashboardFilterSelection>(
    DASHBOARD_DEFAULT_FILTER_SELECTION,
  )
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false)
  const [createError, setCreateError] = createSignal<string | ExistingProcessConflict | null>(null)

  const providerFilterOptions = createMemo(() =>
    deriveDashboardProviderFilterOptions(processes() ?? []),
  )
  const statusFilterOptions = createMemo(() =>
    deriveDashboardStatusFilterOptions(processes() ?? []),
  )
  const filteredProcesses = createMemo(() =>
    filterDashboardProcesses(processes() ?? [], filterSelection()),
  )
  const sortedProcesses = createMemo(() =>
    sortDashboardProcesses(filteredProcesses(), sortSelection()),
  )

  onMount(() => {
    const resolvedSortSelection = resolveDashboardSortSelectionWithStorageFallback(
      new URLSearchParams(location.search),
      readDashboardSortFromLocalStorage(),
    )

    setSortSelection(resolvedSortSelection)
  })

  const handleCreateProcess = () => {
    setCreateError(null)
    setIsCreateDialogOpen(true)
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
    setFilterSelection((currentSelection) => {
      return toggleDashboardProviderFilter(currentSelection, provider)
    })
  }

  const handleStatusFilterToggle = (status: TrackingStatusCode) => {
    setFilterSelection((currentSelection) => {
      return toggleDashboardStatusFilter(currentSelection, status)
    })
  }

  const handleProcessSubmit = async (data: CreateProcessDialogFormData) => {
    try {
      setCreateError(null)

      const processId = await createProcessRequest(toCreateProcessInput(data))

      // Refetch processes list
      await refetch()

      // Close dialog
      setIsCreateDialogOpen(false)

      // Navigate to the new process
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
      <AppHeader onCreateProcess={handleCreateProcess} />
      <CreateProcessDialog
        open={isCreateDialogOpen()}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleProcessSubmit}
      />

      <main class="mx-auto max-w-7xl px-4 py-4 lg:px-6">
        <Show when={props.searchSlot}>
          <div class="mb-4 flex justify-center">{props.searchSlot}</div>
        </Show>

        {/* Error message */}
        <Show when={createError()}>
          <ExistingProcessError
            message={createErrorMessage()}
            existing={createErrorExisting()}
            onAcknowledge={() => setCreateError(null)}
          />
        </Show>

        <DashboardMetricsGrid
          statuses={(processes() ?? []).map((process) => ({ status: process.status }))}
        />
        <DashboardProcessFiltersBar
          providers={providerFilterOptions()}
          statuses={statusFilterOptions()}
          selectedProviders={filterSelection().providers}
          selectedStatuses={filterSelection().statuses}
          onProviderToggle={handleProviderFilterToggle}
          onStatusToggle={handleStatusFilterToggle}
        />
        <DashboardProcessTable
          processes={sortedProcesses()}
          loading={processes.loading}
          hasError={Boolean(processes.error)}
          onCreateProcess={handleCreateProcess}
          sortSelection={sortSelection()}
          onSortToggle={handleSortToggle}
        />
      </main>
    </div>
  )
}
