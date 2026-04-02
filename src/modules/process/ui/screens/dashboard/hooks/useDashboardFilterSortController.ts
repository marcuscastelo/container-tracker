import type { Accessor } from 'solid-js'
import { createSignal, onMount } from 'solid-js'
import type { ProcessStatusCode } from '~/modules/process/ui/process-status-color'
import { emitDashboardSortChangedTelemetry } from '~/modules/process/ui/telemetry/dashboardSort.telemetry'
import {
  readDashboardFiltersFromLocalStorage,
  writeDashboardFiltersToLocalStorage,
} from '~/modules/process/ui/validation/dashboardFilterStorage.validation'
import {
  readDashboardSortFromLocalStorage,
  writeDashboardSortToLocalStorage,
} from '~/modules/process/ui/validation/dashboardSortStorage.validation'
import {
  DASHBOARD_DEFAULT_FILTER_SELECTION,
  type DashboardFilterSelection,
  type DashboardImporterFilterValue,
  type DashboardSeverityFilterValue,
  setDashboardImporterFilter,
  setDashboardSeverityFilter,
  toggleDashboardProviderFilter,
  toggleDashboardStatusFilter,
} from '~/modules/process/ui/viewmodels/dashboard-filter.service'
import { nextDashboardSortSelection } from '~/modules/process/ui/viewmodels/dashboard-sort.service'
import type {
  DashboardSortField,
  DashboardSortSelection,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import { DASHBOARD_DEFAULT_SORT_SELECTION } from '~/modules/process/ui/viewmodels/dashboard-sort.vm'

type DashboardFilterSortControllerResult = {
  readonly sortSelection: Accessor<DashboardSortSelection>
  readonly filterSelection: Accessor<DashboardFilterSelection>
  readonly isHydrated: Accessor<boolean>
  readonly handleSortToggle: (field: DashboardSortField) => void
  readonly handleProviderFilterToggle: (provider: string) => void
  readonly handleStatusFilterToggle: (status: ProcessStatusCode) => void
  readonly handleImporterFilterSelect: (importer: DashboardImporterFilterValue | null) => void
  readonly handleSeverityFilterSelect: (severity: DashboardSeverityFilterValue | null) => void
  readonly handleClearAllFilters: () => void
}

export function useDashboardFilterSortController(): DashboardFilterSortControllerResult {
  const [sortSelection, setSortSelection] = createSignal<DashboardSortSelection>(
    DASHBOARD_DEFAULT_SORT_SELECTION,
  )
  const [filterSelection, setFilterSelection] = createSignal<DashboardFilterSelection>(
    DASHBOARD_DEFAULT_FILTER_SELECTION,
  )
  const [isHydrated, setIsHydrated] = createSignal(false)

  onMount(() => {
    setSortSelection(readDashboardSortFromLocalStorage())
    setFilterSelection(readDashboardFiltersFromLocalStorage())
    setIsHydrated(true)
  })

  const persistDashboardFilters = (nextFilterSelection: DashboardFilterSelection) => {
    setFilterSelection(nextFilterSelection)
    writeDashboardFiltersToLocalStorage(nextFilterSelection)
  }

  const handleSortToggle = (field: DashboardSortField) => {
    const nextSelection = nextDashboardSortSelection(sortSelection(), field)
    setSortSelection(nextSelection)
    emitDashboardSortChangedTelemetry('user', field, nextSelection)
    writeDashboardSortToLocalStorage(nextSelection)
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

  return {
    sortSelection,
    filterSelection,
    isHydrated,
    handleSortToggle,
    handleProviderFilterToggle,
    handleStatusFilterToggle,
    handleImporterFilterSelect,
    handleSeverityFilterSelect,
    handleClearAllFilters,
  }
}
