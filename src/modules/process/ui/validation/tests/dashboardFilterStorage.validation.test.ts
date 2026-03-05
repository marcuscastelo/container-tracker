import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_FILTER_STORAGE_KEY,
  readDashboardFiltersFromLocalStorage,
  writeDashboardFiltersToLocalStorage,
} from '~/modules/process/ui/validation/dashboardFilterStorage.validation'
import { DASHBOARD_DEFAULT_FILTER_SELECTION } from '~/modules/process/ui/viewmodels/dashboard-filter-interaction.vm'

type FilterStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function createInMemoryFilterStorage(initial?: Record<string, string>): FilterStorage {
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

describe('dashboard filter local storage contract', () => {
  it('reads a valid stored filter selection', () => {
    const storage = createInMemoryFilterStorage({
      [DASHBOARD_FILTER_STORAGE_KEY]:
        'provider=MAERSK&status=IN_TRANSIT&importerId=importer-42&importerName=Empresa%20ABC',
    })

    const result = readDashboardFiltersFromLocalStorage(storage)

    expect(result).toEqual({
      providers: ['MAERSK'],
      statuses: ['IN_TRANSIT'],
      importerId: 'importer-42',
      importerName: 'Empresa ABC',
    })
  })

  it('returns default filters when stored value is invalid', () => {
    const storage = createInMemoryFilterStorage({
      [DASHBOARD_FILTER_STORAGE_KEY]: 'provider=%20&status=INVALID&importerId=%20',
    })

    expect(readDashboardFiltersFromLocalStorage(storage)).toBe(DASHBOARD_DEFAULT_FILTER_SELECTION)
  })

  it('writes filter selection as query-contract string', () => {
    const storage = createInMemoryFilterStorage()

    writeDashboardFiltersToLocalStorage(
      {
        providers: ['MSC'],
        statuses: ['DELIVERED'],
        importerId: 'importer-7',
        importerName: 'Importadora Sul',
      },
      storage,
    )

    expect(storage.getItem(DASHBOARD_FILTER_STORAGE_KEY)).toBe(
      'provider=MSC&status=DELIVERED&importerId=importer-7&importerName=Importadora+Sul',
    )
  })

  it('clears stored filters when selection is reset to default', () => {
    const storage = createInMemoryFilterStorage({
      [DASHBOARD_FILTER_STORAGE_KEY]:
        'provider=MAERSK&status=IN_TRANSIT&importerId=importer-42&importerName=Empresa%20ABC',
    })

    writeDashboardFiltersToLocalStorage(DASHBOARD_DEFAULT_FILTER_SELECTION, storage)

    expect(storage.getItem(DASHBOARD_FILTER_STORAGE_KEY)).toBeNull()
  })

  it('guards against storage errors while reading', () => {
    const brokenStorage: FilterStorage = {
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

    expect(readDashboardFiltersFromLocalStorage(brokenStorage)).toBe(
      DASHBOARD_DEFAULT_FILTER_SELECTION,
    )
  })

  it('returns explicit default filters when storage is unavailable', () => {
    expect(readDashboardFiltersFromLocalStorage(null)).toBe(DASHBOARD_DEFAULT_FILTER_SELECTION)
  })
})
