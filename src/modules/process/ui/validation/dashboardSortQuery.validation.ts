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
