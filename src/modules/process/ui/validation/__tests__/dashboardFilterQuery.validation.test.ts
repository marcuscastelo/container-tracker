import { describe, expect, it } from 'vitest'
import {
  applyDashboardFiltersToSearchParams,
  hasDashboardFilterQueryParams,
  hydrateDashboardFiltersFromQueryAndStorage,
  parseDashboardFiltersFromSearchParams,
  resolveDashboardFilterSelectionWithStorageFallback,
  serializeDashboardFiltersToSearchParams,
} from '~/modules/process/ui/validation/dashboardFilterQuery.validation'
import {
  DASHBOARD_DEFAULT_FILTER_SELECTION,
  type DashboardFilterSelection,
} from '~/modules/process/ui/viewmodels/dashboard-filter-interaction.vm'

describe('dashboard filter query parsing contract', () => {
  it('parses valid provider, status, and importer params into filter state', () => {
    const searchParams = new URLSearchParams({
      provider: 'MAERSK',
      status: 'IN_TRANSIT',
      importerId: 'importer-42',
      importerName: 'Empresa ABC',
    })

    const result = parseDashboardFiltersFromSearchParams(searchParams)

    expect(result).toEqual({
      providers: ['MAERSK'],
      statuses: ['IN_TRANSIT'],
      importerId: 'importer-42',
      importerName: 'Empresa ABC',
    })
  })

  it('parses repeated provider and status params as multi-value filters', () => {
    const searchParams = new URLSearchParams(
      'provider=MAERSK&provider=MSC&status=IN_PROGRESS&status=DELIVERED',
    )

    const result = parseDashboardFiltersFromSearchParams(searchParams)

    expect(result.providers).toEqual(['MAERSK', 'MSC'])
    expect(result.statuses).toEqual(['IN_PROGRESS', 'DELIVERED'])
  })

  it('returns explicit default selection when params are absent or invalid', () => {
    const searchParams = new URLSearchParams(
      'provider=%20%20&provider=&status=INVALID&status=%20&importerId=%20&importerName=',
    )

    const result = parseDashboardFiltersFromSearchParams(searchParams)

    expect(result).toBe(DASHBOARD_DEFAULT_FILTER_SELECTION)
  })

  it('ignores invalid values and deduplicates valid values safely', () => {
    const searchParams = new URLSearchParams(
      'provider=MAERSK&provider=MAERSK&provider=%20&status=IN_TRANSIT&status=INVALID&status=IN_TRANSIT&importerId=%20importer-7%20',
    )

    const result = parseDashboardFiltersFromSearchParams(searchParams)

    expect(result).toEqual({
      providers: ['MAERSK'],
      statuses: ['IN_TRANSIT'],
      importerId: 'importer-7',
      importerName: null,
    })
  })

  it('tracks when URL includes filter query params', () => {
    expect(hasDashboardFilterQueryParams(new URLSearchParams())).toBe(false)
    expect(hasDashboardFilterQueryParams(new URLSearchParams({ provider: 'MAERSK' }))).toBe(true)
    expect(hasDashboardFilterQueryParams(new URLSearchParams({ status: 'IN_TRANSIT' }))).toBe(true)
    expect(hasDashboardFilterQueryParams(new URLSearchParams({ importerId: 'importer-42' }))).toBe(
      true,
    )
    expect(
      hasDashboardFilterQueryParams(new URLSearchParams({ importerName: 'Empresa ABC' })),
    ).toBe(true)
  })
})

describe('dashboard filter query hydration contract', () => {
  it('resolves initial filters with URL precedence over storage fallback', () => {
    const result = resolveDashboardFilterSelectionWithStorageFallback(
      new URLSearchParams({
        provider: 'MSC',
      }),
      {
        providers: ['MAERSK'],
        statuses: ['IN_TRANSIT'],
        importerId: 'importer-42',
        importerName: 'Empresa ABC',
      },
    )

    expect(result).toEqual({
      providers: ['MSC'],
      statuses: [],
      importerId: null,
      importerName: null,
    })
  })

  it('uses storage fallback when URL has no filter params', () => {
    const storageSelection: DashboardFilterSelection = {
      providers: ['MAERSK'],
      statuses: ['IN_TRANSIT'],
      importerId: 'importer-42',
      importerName: 'Empresa ABC',
    }

    const result = resolveDashboardFilterSelectionWithStorageFallback(
      new URLSearchParams({
        sortField: 'createdAt',
        sortDir: 'desc',
      }),
      storageSelection,
    )

    expect(result).toEqual(storageSelection)
  })

  it('uses explicit default filter selection when URL and storage have no active filter', () => {
    const result = resolveDashboardFilterSelectionWithStorageFallback(
      new URLSearchParams(),
      DASHBOARD_DEFAULT_FILTER_SELECTION,
    )

    expect(result).toBe(DASHBOARD_DEFAULT_FILTER_SELECTION)
  })

  it('keeps URL-first precedence when URL filter params are invalid', () => {
    const result = resolveDashboardFilterSelectionWithStorageFallback(
      new URLSearchParams({
        provider: '  ',
        status: 'INVALID',
      }),
      {
        providers: ['MAERSK'],
        statuses: ['IN_TRANSIT'],
        importerId: 'importer-42',
        importerName: 'Empresa ABC',
      },
    )

    expect(result).toBe(DASHBOARD_DEFAULT_FILTER_SELECTION)
  })

  it('hydrates URL params with storage filters when URL has no filter state', () => {
    const result = hydrateDashboardFiltersFromQueryAndStorage(
      new URLSearchParams({
        sortField: 'createdAt',
        sortDir: 'desc',
      }),
      {
        providers: ['MAERSK', 'MSC'],
        statuses: ['IN_TRANSIT'],
        importerId: 'importer-42',
        importerName: 'Empresa ABC',
      },
    )

    expect(result.filterSelection).toEqual({
      providers: ['MAERSK', 'MSC'],
      statuses: ['IN_TRANSIT'],
      importerId: 'importer-42',
      importerName: 'Empresa ABC',
    })
    expect(result.searchParams.get('sortField')).toBe('createdAt')
    expect(result.searchParams.get('sortDir')).toBe('desc')
    expect(result.searchParams.getAll('provider')).toEqual(['MAERSK', 'MSC'])
    expect(result.searchParams.getAll('status')).toEqual(['IN_TRANSIT'])
    expect(result.searchParams.get('importerId')).toBe('importer-42')
    expect(result.searchParams.get('importerName')).toBe('Empresa ABC')
  })

  it('hydrates filters using URL values before storage fallback', () => {
    const result = hydrateDashboardFiltersFromQueryAndStorage(
      new URLSearchParams({
        provider: 'HAPAG',
        status: 'DELIVERED',
        importerName: 'Importadora Sul',
        sortField: 'createdAt',
      }),
      {
        providers: ['MAERSK'],
        statuses: ['IN_TRANSIT'],
        importerId: 'importer-42',
        importerName: 'Empresa ABC',
      },
    )

    expect(result.filterSelection).toEqual({
      providers: ['HAPAG'],
      statuses: ['DELIVERED'],
      importerId: null,
      importerName: 'Importadora Sul',
    })
    expect(result.searchParams.getAll('provider')).toEqual(['HAPAG'])
    expect(result.searchParams.getAll('status')).toEqual(['DELIVERED'])
    expect(result.searchParams.get('importerId')).toBeNull()
    expect(result.searchParams.get('importerName')).toBe('Importadora Sul')
    expect(result.searchParams.get('sortField')).toBe('createdAt')
  })

  it('removes invalid filter params while keeping unrelated query params during hydration', () => {
    const result = hydrateDashboardFiltersFromQueryAndStorage(
      new URLSearchParams({
        provider: '  ',
        status: 'INVALID',
        importerId: ' ',
        importerName: ' ',
        sortDir: 'asc',
      }),
      {
        providers: ['MAERSK'],
        statuses: ['IN_TRANSIT'],
        importerId: 'importer-42',
        importerName: 'Empresa ABC',
      },
    )

    expect(result.filterSelection).toBe(DASHBOARD_DEFAULT_FILTER_SELECTION)
    expect(result.searchParams.getAll('provider')).toEqual([])
    expect(result.searchParams.getAll('status')).toEqual([])
    expect(result.searchParams.get('importerId')).toBeNull()
    expect(result.searchParams.get('importerName')).toBeNull()
    expect(result.searchParams.get('sortDir')).toBe('asc')
  })
})

describe('dashboard filter query serialization contract', () => {
  it('serializes filters using canonical params and drops empty values', () => {
    const result = serializeDashboardFiltersToSearchParams({
      providers: ['MAERSK', 'MAERSK', ' ', 'MSC'],
      statuses: ['IN_TRANSIT', 'UNKNOWN', 'IN_TRANSIT'],
      importerId: '  importer-42  ',
      importerName: '   ',
    })

    expect(result.toString()).toBe(
      'provider=MAERSK&provider=MSC&status=IN_TRANSIT&status=UNKNOWN&importerId=importer-42',
    )
  })

  it('serializes the default filter state to an empty query', () => {
    const result = serializeDashboardFiltersToSearchParams(DASHBOARD_DEFAULT_FILTER_SELECTION)
    expect(result.toString()).toBe('')
  })

  it('applies filters while preserving unrelated query params', () => {
    const result = applyDashboardFiltersToSearchParams(
      new URLSearchParams({
        sortField: 'createdAt',
        q: 'active',
      }),
      {
        providers: ['MAERSK'],
        statuses: ['LOADED'],
        importerId: 'importer-42',
        importerName: 'Empresa',
      },
    )

    expect(result.get('sortField')).toBe('createdAt')
    expect(result.get('q')).toBe('active')
    expect(result.getAll('provider')).toEqual(['MAERSK'])
    expect(result.getAll('status')).toEqual(['LOADED'])
    expect(result.get('importerId')).toBe('importer-42')
    expect(result.get('importerName')).toBe('Empresa')
  })

  it('removes stale filter params when next state is empty', () => {
    const result = applyDashboardFiltersToSearchParams(
      new URLSearchParams({
        provider: 'MAERSK',
        status: 'IN_TRANSIT',
        importerId: 'importer-42',
        importerName: 'Empresa',
        sortDir: 'desc',
      }),
      DASHBOARD_DEFAULT_FILTER_SELECTION,
    )

    expect(result.getAll('provider')).toEqual([])
    expect(result.getAll('status')).toEqual([])
    expect(result.get('importerId')).toBeNull()
    expect(result.get('importerName')).toBeNull()
    expect(result.get('sortDir')).toBe('desc')
  })
})
