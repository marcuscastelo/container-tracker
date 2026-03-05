import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_SORT_STORAGE_KEY,
  readDashboardSortFromLocalStorage,
  writeDashboardSortToLocalStorage,
} from '~/modules/process/ui/validation/dashboardSortStorage.validation'
import { DASHBOARD_DEFAULT_SORT_SELECTION } from '~/modules/process/ui/viewmodels/dashboard-sort.vm'

type SortStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function createInMemorySortStorage(initial?: Record<string, string>): SortStorage {
  const state = new Map<string, string>(Object.entries(initial ?? {}))

  return {
    getItem(key) {
      return state.get(key) ?? null
    },
    setItem(key, value) {
      state.set(key, value)
    },
    removeItem(key) {
      state.delete(key)
    },
  }
}

describe('dashboard sort local storage contract', () => {
  it('reads a valid stored sort selection', () => {
    const storage = createInMemorySortStorage({
      [DASHBOARD_SORT_STORAGE_KEY]: 'sortField=status&sortDir=asc',
    })

    const result = readDashboardSortFromLocalStorage(storage)

    expect(result).toEqual({
      field: 'status',
      direction: 'asc',
    })
  })

  it('returns default sort when stored value is invalid', () => {
    const storage = createInMemorySortStorage({
      [DASHBOARD_SORT_STORAGE_KEY]: 'sortField=invalid&sortDir=desc',
    })

    expect(readDashboardSortFromLocalStorage(storage)).toBe(DASHBOARD_DEFAULT_SORT_SELECTION)
  })

  it('writes sort selection as query-contract string', () => {
    const storage = createInMemorySortStorage()

    writeDashboardSortToLocalStorage(
      {
        field: 'createdAt',
        direction: 'desc',
      },
      storage,
    )

    expect(storage.getItem(DASHBOARD_SORT_STORAGE_KEY)).toBe('sortField=createdAt&sortDir=desc')
  })

  it('clears stored sort when selection is reset to default order', () => {
    const storage = createInMemorySortStorage({
      [DASHBOARD_SORT_STORAGE_KEY]: 'sortField=provider&sortDir=asc',
    })

    writeDashboardSortToLocalStorage(null, storage)

    expect(storage.getItem(DASHBOARD_SORT_STORAGE_KEY)).toBeNull()
  })

  it('guards against storage errors while reading', () => {
    const brokenStorage: SortStorage = {
      getItem() {
        throw new Error('read failure')
      },
      setItem() {
        throw new Error('write failure')
      },
      removeItem() {
        throw new Error('remove failure')
      },
    }

    expect(readDashboardSortFromLocalStorage(brokenStorage)).toBe(DASHBOARD_DEFAULT_SORT_SELECTION)
  })

  it('returns explicit default sort when storage is unavailable', () => {
    expect(readDashboardSortFromLocalStorage(null)).toBe(DASHBOARD_DEFAULT_SORT_SELECTION)
  })
})
