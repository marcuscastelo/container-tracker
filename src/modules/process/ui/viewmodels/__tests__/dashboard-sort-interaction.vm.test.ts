import { describe, expect, it } from 'vitest'
import type { DashboardSortSelection } from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import {
  getActiveDashboardSortDirection,
  nextDashboardSortSelection,
  sortDashboardProcesses,
} from '~/modules/process/ui/viewmodels/dashboard-sort-interaction.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'

function createProcess(
  input: Pick<ProcessSummaryVM, 'id'> & {
    readonly reference?: string | null
    readonly importerName?: string | null
    readonly carrier?: string | null
    readonly status?: ProcessSummaryVM['status']
    readonly eta?: string | null
    readonly lastEventAt?: string | null
  },
): ProcessSummaryVM {
  return {
    id: input.id,
    reference: input.reference ?? null,
    origin: null,
    destination: null,
    importerName: input.importerName ?? null,
    containerCount: 1,
    status: input.status ?? 'unknown',
    statusCode: 'UNKNOWN',
    eta: input.eta ?? null,
    carrier: input.carrier ?? null,
    alertsCount: 0,
    highestAlertSeverity: null,
    hasTransshipment: false,
    lastEventAt: input.lastEventAt ?? null,
  }
}

describe('dashboard sort interactions', () => {
  it('cycles same field in order desc -> asc -> default', () => {
    const first = nextDashboardSortSelection(null, 'provider')
    const second = nextDashboardSortSelection(first, 'provider')
    const third = nextDashboardSortSelection(second, 'provider')

    expect(first).toEqual({ field: 'provider', direction: 'desc' })
    expect(second).toEqual({ field: 'provider', direction: 'asc' })
    expect(third).toBeNull()
  })

  it('keeps a single active field by resetting to desc on another column click', () => {
    const activeProvider: DashboardSortSelection = { field: 'provider', direction: 'asc' }

    expect(nextDashboardSortSelection(activeProvider, 'eta')).toEqual({
      field: 'eta',
      direction: 'desc',
    })
  })

  it('returns active direction only for selected field', () => {
    const selection: DashboardSortSelection = { field: 'importerName', direction: 'desc' }

    expect(getActiveDashboardSortDirection(selection, 'importerName')).toBe('desc')
    expect(getActiveDashboardSortDirection(selection, 'provider')).toBeNull()
  })

  it('keeps baseline order untouched when no sort is active', () => {
    const baseline = [
      createProcess({ id: 'A', reference: 'REF-2' }),
      createProcess({ id: 'B', reference: 'REF-1' }),
    ] as const

    const result = sortDashboardProcesses(baseline, null)

    expect(result).toBe(baseline)
  })

  it('sorts by selected field and direction', () => {
    const baseline = [
      createProcess({ id: 'A', importerName: 'Zeta' }),
      createProcess({ id: 'B', importerName: 'Alpha' }),
      createProcess({ id: 'C', importerName: 'delta' }),
    ] as const

    const descResult = sortDashboardProcesses(baseline, {
      field: 'importerName',
      direction: 'desc',
    })
    const ascResult = sortDashboardProcesses(baseline, {
      field: 'importerName',
      direction: 'asc',
    })

    expect(descResult.map((process) => process.id)).toEqual(['A', 'C', 'B'])
    expect(ascResult.map((process) => process.id)).toEqual(['B', 'C', 'A'])
  })
})
