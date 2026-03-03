export const DASHBOARD_SORT_FIELDS = [
  'processNumber',
  'importerName',
  'createdAt',
  'status',
  'eta',
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
