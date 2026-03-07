import { describe, expect, it } from 'vitest'
import type {
  DashboardSortDirection,
  DashboardSortField,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import { sortDashboardProcesses } from '~/modules/process/ui/viewmodels/dashboard-sort-interaction.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'

function createProcess(
  input: Pick<ProcessSummaryVM, 'id'> & {
    readonly reference?: string | null
    readonly importerName?: string | null
    readonly carrier?: string | null
    readonly eta?: string | null
    readonly etaMsOrNull?: number | null
    readonly lastEventAt?: string | null
  },
): ProcessSummaryVM {
  return {
    id: input.id,
    reference: input.reference ?? null,
    origin: null,
    destination: null,
    importerId: null,
    importerName: input.importerName ?? null,
    containerCount: 1,
    containerNumbers: [],
    status: 'unknown',
    statusCode: 'UNKNOWN',
    statusRank: 0,
    eta: input.eta ?? null,
    etaMsOrNull: input.etaMsOrNull ?? null,
    carrier: input.carrier ?? null,
    alertsCount: 0,
    highestAlertSeverity: null,
    dominantAlertCreatedAt: null,
    hasTransshipment: false,
    lastEventAt: input.lastEventAt ?? null,
    syncStatus: 'idle',
    lastSyncAt: null,
  }
}

function sortIds(
  processes: readonly ProcessSummaryVM[],
  field: DashboardSortField,
  direction: DashboardSortDirection,
): readonly string[] {
  return sortDashboardProcesses(processes, { field, direction }).map((process) => process.id)
}

describe('dashboard sort null and empty policies', () => {
  it('places null and empty importer names at end in asc and start in desc', () => {
    const baseline = [
      createProcess({
        id: 'missing-null',
        importerName: null,
        reference: 'REF-30',
        lastEventAt: '2025-01-01T00:00:00.000Z',
      }),
      createProcess({
        id: 'filled-beta',
        importerName: 'Beta',
        reference: 'REF-20',
        lastEventAt: '2025-01-01T00:00:00.000Z',
      }),
      createProcess({
        id: 'missing-empty',
        importerName: '',
        reference: 'REF-10',
        lastEventAt: '2025-02-01T00:00:00.000Z',
      }),
      createProcess({
        id: 'filled-alpha',
        importerName: 'Alpha',
        reference: 'REF-40',
        lastEventAt: '2025-01-01T00:00:00.000Z',
      }),
    ] as const

    const ascIds = sortIds(baseline, 'importerName', 'asc')
    const descIds = sortIds(baseline, 'importerName', 'desc')

    expect(ascIds).toEqual(['filled-alpha', 'filled-beta', 'missing-empty', 'missing-null'])
    expect(descIds).toEqual(['missing-empty', 'missing-null', 'filled-beta', 'filled-alpha'])
  })

  it('places null and empty providers at end in asc and start in desc', () => {
    const baseline = [
      createProcess({
        id: 'missing-null',
        carrier: null,
        reference: 'REF-30',
        lastEventAt: '2025-01-01T00:00:00.000Z',
      }),
      createProcess({
        id: 'filled-zeta',
        carrier: 'Zeta',
        reference: 'REF-20',
        lastEventAt: '2025-01-01T00:00:00.000Z',
      }),
      createProcess({
        id: 'missing-empty',
        carrier: '   ',
        reference: 'REF-10',
        lastEventAt: '2025-02-01T00:00:00.000Z',
      }),
      createProcess({
        id: 'filled-alpha',
        carrier: 'Alpha',
        reference: 'REF-40',
        lastEventAt: '2025-01-01T00:00:00.000Z',
      }),
    ] as const

    const ascIds = sortIds(baseline, 'provider', 'asc')
    const descIds = sortIds(baseline, 'provider', 'desc')

    expect(ascIds).toEqual(['filled-alpha', 'filled-zeta', 'missing-empty', 'missing-null'])
    expect(descIds).toEqual(['missing-empty', 'missing-null', 'filled-zeta', 'filled-alpha'])
  })

  it('places null and empty process numbers at end in asc and start in desc', () => {
    const baseline = [
      createProcess({
        id: 'missing-null',
        reference: null,
        lastEventAt: '2025-01-01T00:00:00.000Z',
      }),
      createProcess({
        id: 'filled-p20',
        reference: 'P-20',
        lastEventAt: '2025-01-01T00:00:00.000Z',
      }),
      createProcess({
        id: 'missing-empty',
        reference: '',
        lastEventAt: '2025-02-01T00:00:00.000Z',
      }),
      createProcess({
        id: 'filled-p11',
        reference: 'P-11',
        lastEventAt: '2025-01-01T00:00:00.000Z',
      }),
    ] as const

    const ascIds = sortIds(baseline, 'processNumber', 'asc')
    const descIds = sortIds(baseline, 'processNumber', 'desc')

    expect(ascIds).toEqual(['filled-p11', 'filled-p20', 'missing-empty', 'missing-null'])
    expect(descIds).toEqual(['missing-empty', 'missing-null', 'filled-p20', 'filled-p11'])
  })

  it('keeps null createdAt values at the end in both directions', () => {
    const baseline = [
      createProcess({ id: 'missing-created', reference: 'REF-1', lastEventAt: null }),
      createProcess({
        id: 'created-old',
        reference: 'REF-2',
        lastEventAt: '2025-01-01T00:00:00.000Z',
      }),
      createProcess({
        id: 'created-new',
        reference: 'REF-3',
        lastEventAt: '2025-03-01T00:00:00.000Z',
      }),
    ] as const

    const ascIds = sortIds(baseline, 'createdAt', 'asc')
    const descIds = sortIds(baseline, 'createdAt', 'desc')

    expect(ascIds).toEqual(['created-old', 'created-new', 'missing-created'])
    expect(descIds).toEqual(['created-new', 'created-old', 'missing-created'])
  })

  it('keeps null eta values at the end in both directions', () => {
    const baseline = [
      createProcess({ id: 'missing-eta', reference: 'REF-1', etaMsOrNull: null }),
      createProcess({ id: 'eta-old', reference: 'REF-2', etaMsOrNull: 1735689600000 }),
      createProcess({ id: 'eta-new', reference: 'REF-3', etaMsOrNull: 1740787200000 }),
    ] as const

    const ascIds = sortIds(baseline, 'eta', 'asc')
    const descIds = sortIds(baseline, 'eta', 'desc')

    expect(ascIds).toEqual(['eta-old', 'eta-new', 'missing-eta'])
    expect(descIds).toEqual(['eta-new', 'eta-old', 'missing-eta'])
  })
})
