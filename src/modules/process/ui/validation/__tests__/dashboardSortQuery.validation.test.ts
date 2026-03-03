import { describe, expect, it } from 'vitest'
import {
  applyDashboardSortToSearchParams,
  hasDashboardSortQueryParams,
  parseDashboardSortFromSearchParams,
  resolveDashboardSortSelectionWithStorageFallback,
  serializeDashboardSortToSearchParams,
} from '~/modules/process/ui/validation/dashboardSortQuery.validation'
import {
  DASHBOARD_DEFAULT_SORT_SELECTION,
  DASHBOARD_SORT_DIRECTIONS,
  DASHBOARD_SORT_FIELDS,
  type DashboardSortSelection,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'

describe('dashboard sort query contract', () => {
  it('parses valid query params into sort state', () => {
    const searchParams = new URLSearchParams({
      sortField: 'importerName',
      sortDir: 'asc',
    })

    const result = parseDashboardSortFromSearchParams(searchParams)

    expect(result).toEqual({
      field: 'importerName',
      direction: 'asc',
    })
  })

  it('uses default order when URL has no sort params', () => {
    const searchParams = new URLSearchParams()

    const result = parseDashboardSortFromSearchParams(searchParams)
    expect(result).toBe(DASHBOARD_DEFAULT_SORT_SELECTION)
  })

  it('resolves to no active sort when sortField is invalid', () => {
    const searchParams = new URLSearchParams({
      sortField: 'invalid-field',
      sortDir: 'asc',
    })

    const result = parseDashboardSortFromSearchParams(searchParams)
    expect(result).toBeNull()
  })

  it('resolves to no active sort when sortDir is invalid', () => {
    const searchParams = new URLSearchParams({
      sortField: 'status',
      sortDir: 'invalid-direction',
    })

    const result = parseDashboardSortFromSearchParams(searchParams)
    expect(result).toBeNull()
  })

  it('resolves to no active sort when one sort param is missing', () => {
    const withOnlyField = new URLSearchParams({
      sortField: 'eta',
    })
    const withOnlyDirection = new URLSearchParams({
      sortDir: 'desc',
    })

    expect(parseDashboardSortFromSearchParams(withOnlyField)).toBeNull()
    expect(parseDashboardSortFromSearchParams(withOnlyDirection)).toBeNull()
  })

  it('tracks when URL includes sort query params', () => {
    expect(hasDashboardSortQueryParams(new URLSearchParams())).toBe(false)
    expect(hasDashboardSortQueryParams(new URLSearchParams({ sortField: 'status' }))).toBe(true)
    expect(hasDashboardSortQueryParams(new URLSearchParams({ sortDir: 'asc' }))).toBe(true)
  })

  it('resolves initial sort with URL precedence over storage fallback', () => {
    const urlSelection = new URLSearchParams({
      sortField: 'status',
      sortDir: 'desc',
    })
    const storageSelection: DashboardSortSelection = {
      field: 'provider',
      direction: 'asc',
    }

    const result = resolveDashboardSortSelectionWithStorageFallback(urlSelection, storageSelection)
    expect(result).toEqual({ field: 'status', direction: 'desc' })
  })

  it('uses storage fallback when URL has no sort params', () => {
    const storageSelection: DashboardSortSelection = {
      field: 'createdAt',
      direction: 'asc',
    }

    const result = resolveDashboardSortSelectionWithStorageFallback(
      new URLSearchParams(),
      storageSelection,
    )
    expect(result).toEqual(storageSelection)
  })

  it('uses explicit default sort selection when URL and storage have no active sort', () => {
    const result = resolveDashboardSortSelectionWithStorageFallback(
      new URLSearchParams(),
      DASHBOARD_DEFAULT_SORT_SELECTION,
    )

    expect(result).toBe(DASHBOARD_DEFAULT_SORT_SELECTION)
  })

  it('keeps URL-first precedence when URL sort params are invalid', () => {
    const invalidUrlSelection = new URLSearchParams({
      sortField: 'invalid',
      sortDir: 'asc',
    })
    const storageSelection: DashboardSortSelection = {
      field: 'provider',
      direction: 'desc',
    }

    const result = resolveDashboardSortSelectionWithStorageFallback(
      invalidUrlSelection,
      storageSelection,
    )

    expect(result).toBe(DASHBOARD_DEFAULT_SORT_SELECTION)
  })

  it('roundtrips URL-to-state and state-to-URL for all supported sort fields', () => {
    for (const field of DASHBOARD_SORT_FIELDS) {
      for (const direction of DASHBOARD_SORT_DIRECTIONS) {
        const state: DashboardSortSelection = {
          field,
          direction,
        }

        const serialized = serializeDashboardSortToSearchParams(state)
        const parsed = parseDashboardSortFromSearchParams(serialized)

        expect(parsed).toEqual(state)
      }
    }
  })

  it('serializes no active sort to an empty query', () => {
    const serialized = serializeDashboardSortToSearchParams(DASHBOARD_DEFAULT_SORT_SELECTION)
    expect(serialized.toString()).toBe('')
  })

  it('applies sort params while preserving unrelated query params', () => {
    const result = applyDashboardSortToSearchParams(
      new URLSearchParams({
        q: 'active',
      }),
      { field: 'eta', direction: 'desc' },
    )

    expect(result.get('q')).toBe('active')
    expect(result.get('sortField')).toBe('eta')
    expect(result.get('sortDir')).toBe('desc')
  })

  it('removes sort params when no active sort is selected', () => {
    const result = applyDashboardSortToSearchParams(
      new URLSearchParams({
        sortField: 'provider',
        sortDir: 'asc',
        q: 'active',
      }),
      null,
    )

    expect(result.get('sortField')).toBeNull()
    expect(result.get('sortDir')).toBeNull()
    expect(result.get('q')).toBe('active')
  })
})
