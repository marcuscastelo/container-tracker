import { describe, expect, it } from 'vitest'
import {
  parseDashboardSortFromSearchParams,
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
})
