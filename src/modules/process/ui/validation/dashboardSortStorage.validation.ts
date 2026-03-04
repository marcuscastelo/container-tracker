import {
  parseDashboardSortFromSearchParams,
  serializeDashboardSortToSearchParams,
} from '~/modules/process/ui/validation/dashboardSortQuery.validation'
import {
  DASHBOARD_DEFAULT_SORT_SELECTION,
  type DashboardSortSelection,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'

export const DASHBOARD_SORT_STORAGE_KEY = 'dashboardSort'

type DashboardSortStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function getLocalStorageOrNull(): DashboardSortStorage | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function parseDashboardSortFromStorageValue(storageValue: string | null): DashboardSortSelection {
  if (storageValue === null) return DASHBOARD_DEFAULT_SORT_SELECTION

  const searchParams = new URLSearchParams(storageValue)
  return parseDashboardSortFromSearchParams(searchParams)
}

function serializeDashboardSortToStorageValue(
  sortSelection: DashboardSortSelection,
): string | null {
  const serialized = serializeDashboardSortToSearchParams(sortSelection).toString()
  if (serialized.length === 0) return null
  return serialized
}

export function readDashboardSortFromLocalStorage(
  storage: DashboardSortStorage | null = getLocalStorageOrNull(),
): DashboardSortSelection {
  if (storage === null) {
    return DASHBOARD_DEFAULT_SORT_SELECTION
  }

  try {
    return parseDashboardSortFromStorageValue(storage.getItem(DASHBOARD_SORT_STORAGE_KEY))
  } catch {
    return DASHBOARD_DEFAULT_SORT_SELECTION
  }
}

export function writeDashboardSortToLocalStorage(
  sortSelection: DashboardSortSelection,
  storage: DashboardSortStorage | null = getLocalStorageOrNull(),
): void {
  if (storage === null) {
    return
  }

  try {
    const serialized = serializeDashboardSortToStorageValue(sortSelection)

    if (serialized === null) {
      storage.removeItem(DASHBOARD_SORT_STORAGE_KEY)
      return
    }

    storage.setItem(DASHBOARD_SORT_STORAGE_KEY, serialized)
  } catch {
    // Ignore storage failures and keep in-memory sort state active.
  }
}
