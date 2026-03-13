import type { useNavigate } from '@solidjs/router'
import type { Accessor } from 'solid-js'
import { createSignal, onMount } from 'solid-js'
import type { ProcessStatusCode } from '~/modules/process/ui/process-status-color'
import { emitDashboardSortChangedTelemetry } from '~/modules/process/ui/telemetry/dashboardSort.telemetry'
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

type UseDashboardFilterSortControllerCommand = {
  readonly pathname: Accessor<string>
  readonly search: Accessor<string>
  readonly navigate: ReturnType<typeof useNavigate>
}

type DashboardFilterSortControllerResult = {
  readonly sortSelection: Accessor<DashboardSortSelection>
  readonly filterSelection: Accessor<DashboardFilterSelection>
  readonly handleSortToggle: (field: DashboardSortField) => void
  readonly handleProviderFilterToggle: (provider: string) => void
  readonly handleStatusFilterToggle: (status: ProcessStatusCode) => void
  readonly handleImporterFilterSelect: (importer: DashboardImporterFilterValue | null) => void
  readonly handleSeverityFilterSelect: (severity: DashboardSeverityFilterValue | null) => void
  readonly handleClearAllFilters: () => void
}

function toPathWithSearch(pathname: string, searchParams: URLSearchParams): string {
  const query = searchParams.toString()
  return query.length > 0 ? `${pathname}?${query}` : pathname
}

export function useDashboardFilterSortController(
  command: UseDashboardFilterSortControllerCommand,
): DashboardFilterSortControllerResult {
  const [sortSelection, setSortSelection] = createSignal<DashboardSortSelection>(
    parseDashboardSortFromSearchParams(new URLSearchParams(command.search())),
  )
  const [filterSelection, setFilterSelection] = createSignal<DashboardFilterSelection>(
    parseDashboardFiltersFromSearchParams(new URLSearchParams(command.search())),
  )

  onMount(() => {
    const initialSearchParams = new URLSearchParams(command.search())
    const hydratedSort = hydrateDashboardSortFromQueryAndStorage(
      initialSearchParams,
      readDashboardSortFromLocalStorage(),
    )
    const hydratedFilters = hydrateDashboardFiltersFromQueryAndStorage(
      hydratedSort.searchParams,
      readDashboardFiltersFromLocalStorage(),
    )

    setSortSelection(hydratedSort.sortSelection)
    setFilterSelection(hydratedFilters.filterSelection)

    const currentPath = toPathWithSearch(command.pathname(), initialSearchParams)
    const hydratedPath = toPathWithSearch(command.pathname(), hydratedFilters.searchParams)
    if (currentPath !== hydratedPath) {
      void command.navigate(hydratedPath, { replace: true })
    }
  })

  const persistDashboardFilters = (nextFilterSelection: DashboardFilterSelection) => {
    setFilterSelection(nextFilterSelection)
    writeDashboardFiltersToLocalStorage(nextFilterSelection)

    const nextSearchParams = applyDashboardFiltersToSearchParams(
      new URLSearchParams(command.search()),
      nextFilterSelection,
    )
    void command.navigate(toPathWithSearch(command.pathname(), nextSearchParams), { replace: true })
  }

  const handleSortToggle = (field: DashboardSortField) => {
    const nextSelection = nextDashboardSortSelection(sortSelection(), field)
    setSortSelection(nextSelection)
    emitDashboardSortChangedTelemetry('user', field, nextSelection)
    writeDashboardSortToLocalStorage(nextSelection)

    const nextSearchParams = applyDashboardSortToSearchParams(
      new URLSearchParams(command.search()),
      nextSelection,
    )
    void command.navigate(toPathWithSearch(command.pathname(), nextSearchParams), { replace: true })
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
    handleSortToggle,
    handleProviderFilterToggle,
    handleStatusFilterToggle,
    handleImporterFilterSelect,
    handleSeverityFilterSelect,
    handleClearAllFilters,
  }
}
