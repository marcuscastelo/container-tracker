export const DASHBOARD_SORT_FIELDS = [
  'processNumber',
  'importerName',
  'exporterName',
  'createdAt',
  'status',
  'eta',
  'alerts',
  'provider',
] as const

export type DashboardSortField = (typeof DASHBOARD_SORT_FIELDS)[number]

export const DASHBOARD_SORT_DIRECTIONS = ['asc', 'desc'] as const

export type DashboardSortDirection = (typeof DASHBOARD_SORT_DIRECTIONS)[number]

export type DashboardSortState = {
  readonly field: DashboardSortField
  readonly direction: DashboardSortDirection
}

export type DashboardSortSelection = DashboardSortState | null

export const DASHBOARD_DEFAULT_SORT_SELECTION: DashboardSortSelection = null
