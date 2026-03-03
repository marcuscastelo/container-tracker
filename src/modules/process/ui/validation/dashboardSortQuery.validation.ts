import {
  DASHBOARD_DEFAULT_SORT_SELECTION,
  type DashboardSortDirection,
  type DashboardSortField,
  type DashboardSortSelection,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'

const SORT_FIELD_QUERY_KEY = 'sortField'
const SORT_DIR_QUERY_KEY = 'sortDir'

function parseDashboardSortField(value: string | null): DashboardSortField | null {
  switch (value) {
    case 'processNumber':
    case 'importerName':
    case 'createdAt':
    case 'status':
    case 'eta':
    case 'provider':
      return value
    default:
      return null
  }
}

function parseDashboardSortDirection(value: string | null): DashboardSortDirection | null {
  switch (value) {
    case 'asc':
    case 'desc':
      return value
    default:
      return null
  }
}

export function parseDashboardSortFromSearchParams(
  searchParams: URLSearchParams,
): DashboardSortSelection {
  const field = parseDashboardSortField(searchParams.get(SORT_FIELD_QUERY_KEY))
  const direction = parseDashboardSortDirection(searchParams.get(SORT_DIR_QUERY_KEY))

  if (field === null || direction === null) {
    return DASHBOARD_DEFAULT_SORT_SELECTION
  }

  return { field, direction }
}

export function hasDashboardSortQueryParams(searchParams: URLSearchParams): boolean {
  return searchParams.has(SORT_FIELD_QUERY_KEY) || searchParams.has(SORT_DIR_QUERY_KEY)
}

export function resolveDashboardSortSelectionWithStorageFallback(
  searchParams: URLSearchParams,
  storageSortSelection: DashboardSortSelection,
): DashboardSortSelection {
  if (hasDashboardSortQueryParams(searchParams)) {
    return parseDashboardSortFromSearchParams(searchParams)
  }

  return storageSortSelection
}

export function serializeDashboardSortToSearchParams(
  sortSelection: DashboardSortSelection,
): URLSearchParams {
  const searchParams = new URLSearchParams()

  if (sortSelection === null) {
    return searchParams
  }

  searchParams.set(SORT_FIELD_QUERY_KEY, sortSelection.field)
  searchParams.set(SORT_DIR_QUERY_KEY, sortSelection.direction)
  return searchParams
}

export function applyDashboardSortToSearchParams(
  currentSearchParams: URLSearchParams,
  sortSelection: DashboardSortSelection,
): URLSearchParams {
  const nextSearchParams = new URLSearchParams(currentSearchParams)

  nextSearchParams.delete(SORT_FIELD_QUERY_KEY)
  nextSearchParams.delete(SORT_DIR_QUERY_KEY)

  if (sortSelection === null) {
    return nextSearchParams
  }

  nextSearchParams.set(SORT_FIELD_QUERY_KEY, sortSelection.field)
  nextSearchParams.set(SORT_DIR_QUERY_KEY, sortSelection.direction)
  return nextSearchParams
}
