import {
  parseDashboardFiltersFromSearchParams,
  serializeDashboardFiltersToSearchParams,
} from '~/modules/process/ui/validation/dashboardFilterQuery.validation'
import {
  DASHBOARD_DEFAULT_FILTER_SELECTION,
  type DashboardFilterSelection,
} from '~/modules/process/ui/viewmodels/dashboard-filter-interaction.vm'

export const DASHBOARD_FILTER_STORAGE_KEY = 'dashboardFilters'

type DashboardFilterStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function getLocalStorageOrNull(): DashboardFilterStorage | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function parseDashboardFiltersFromStorageValue(
  storageValue: string | null,
): DashboardFilterSelection {
  if (storageValue === null) return DASHBOARD_DEFAULT_FILTER_SELECTION

  const searchParams = new URLSearchParams(storageValue)
  return parseDashboardFiltersFromSearchParams(searchParams)
}

function serializeDashboardFiltersToStorageValue(
  filterSelection: DashboardFilterSelection,
): string | null {
  const serialized = serializeDashboardFiltersToSearchParams(filterSelection).toString()
  if (serialized.length === 0) return null
  return serialized
}

export function readDashboardFiltersFromLocalStorage(
  storage: DashboardFilterStorage | null = getLocalStorageOrNull(),
): DashboardFilterSelection {
  if (storage === null) {
    return DASHBOARD_DEFAULT_FILTER_SELECTION
  }

  try {
    return parseDashboardFiltersFromStorageValue(storage.getItem(DASHBOARD_FILTER_STORAGE_KEY))
  } catch {
    return DASHBOARD_DEFAULT_FILTER_SELECTION
  }
}

export function writeDashboardFiltersToLocalStorage(
  filterSelection: DashboardFilterSelection,
  storage: DashboardFilterStorage | null = getLocalStorageOrNull(),
): void {
  if (storage === null) {
    return
  }

  try {
    const serialized = serializeDashboardFiltersToStorageValue(filterSelection)

    if (serialized === null) {
      storage.removeItem(DASHBOARD_FILTER_STORAGE_KEY)
      return
    }

    storage.setItem(DASHBOARD_FILTER_STORAGE_KEY, serialized)
  } catch {
    // Ignore storage failures and keep in-memory filter state active.
  }
}
