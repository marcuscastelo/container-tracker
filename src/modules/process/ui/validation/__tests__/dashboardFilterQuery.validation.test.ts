import { describe, expect, it } from 'vitest'
import {
  applyDashboardFiltersToSearchParams,
  parseDashboardFiltersFromSearchParams,
  serializeDashboardFiltersToSearchParams,
} from '~/modules/process/ui/validation/dashboardFilterQuery.validation'
import { DASHBOARD_DEFAULT_FILTER_SELECTION } from '~/modules/process/ui/viewmodels/dashboard-filter-interaction.vm'

describe('dashboard filter query contract', () => {
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
