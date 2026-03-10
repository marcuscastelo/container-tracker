import { describe, expect, it } from 'vitest'
import {
  getActiveDashboardSortDirection,
  nextDashboardSortSelection,
  sortDashboardProcesses,
} from '~/modules/process/ui/viewmodels/dashboard-sort.service'
import type { DashboardSortSelection } from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'

function toTimestampOrNull(value: string | null): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function createProcess(
  input: Pick<ProcessSummaryVM, 'id'> & {
    readonly reference?: string | null
    readonly importerId?: string | null
    readonly importerName?: string | null
    readonly carrier?: string | null
    readonly status?: ProcessSummaryVM['status']
    readonly statusCode?: ProcessSummaryVM['statusCode']
    readonly statusRank?: number
    readonly eta?: string | null
    readonly etaMsOrNull?: number | null
    readonly lastEventAt?: string | null
    readonly dominantAlertCreatedAt?: string | null
  },
): ProcessSummaryVM {
  const eta = input.eta ?? null
  const etaMsOrNull = input.etaMsOrNull ?? toTimestampOrNull(eta)

  return {
    id: input.id,
    reference: input.reference ?? null,
    origin: null,
    destination: null,
    importerId: input.importerId ?? null,
    importerName: input.importerName ?? null,
    exporterName: null,
    containerCount: 1,
    containerNumbers: [],
    status: input.status ?? 'unknown',
    statusCode: input.statusCode ?? 'UNKNOWN',
    statusMicrobadge: null,
    statusRank: input.statusRank ?? 0,
    eta,
    etaMsOrNull,
    carrier: input.carrier ?? null,
    alertsCount: 0,
    highestAlertSeverity: null,
    dominantAlertCreatedAt: input.dominantAlertCreatedAt ?? null,
    hasTransshipment: false,
    lastEventAt: input.lastEventAt ?? null,
    syncStatus: 'idle',
    lastSyncAt: null,
  }
}

function createImporterTieBreakProcesses(): readonly ProcessSummaryVM[] {
  return [
    createProcess({
      id: 'proc-04',
      importerName: 'Same',
      reference: null,
      lastEventAt: '2025-03-01T00:00:00.000Z',
    }),
    createProcess({
      id: 'proc-03',
      importerName: 'Same',
      reference: null,
      lastEventAt: '2025-03-01T00:00:00.000Z',
    }),
    createProcess({
      id: 'proc-02',
      importerName: 'Same',
      reference: 'PROC-20',
      lastEventAt: '2025-03-01T00:00:00.000Z',
    }),
    createProcess({
      id: 'proc-01',
      importerName: 'Same',
      reference: 'PROC-10',
      lastEventAt: '2025-03-01T00:00:00.000Z',
    }),
    createProcess({
      id: 'proc-00',
      importerName: 'Same',
      reference: 'PROC-10',
      lastEventAt: '2025-03-01T00:00:00.000Z',
    }),
  ] as const
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

  it('sorts process number lexicographically for MVP', () => {
    const baseline = [
      createProcess({ id: 'A', reference: 'P-3' }),
      createProcess({ id: 'B', reference: 'P-20' }),
      createProcess({ id: 'C', reference: 'P-11' }),
    ] as const

    const ascResult = sortDashboardProcesses(baseline, {
      field: 'processNumber',
      direction: 'asc',
    })

    expect(ascResult.map((process) => process.reference)).toEqual(['P-11', 'P-20', 'P-3'])
  })

  it('sorts provider case-insensitively', () => {
    const baseline = [
      createProcess({ id: 'A', carrier: 'zeta' }),
      createProcess({ id: 'B', carrier: 'Alpha' }),
      createProcess({ id: 'C', carrier: 'delta' }),
    ] as const

    const ascResult = sortDashboardProcesses(baseline, { field: 'provider', direction: 'asc' })

    expect(ascResult.map((process) => process.id)).toEqual(['B', 'C', 'A'])
  })

  it('sorts created date using timestamp order', () => {
    const baseline = [
      createProcess({ id: 'A', lastEventAt: '2025-03-01T00:00:00.000Z' }),
      createProcess({ id: 'B', lastEventAt: '2025-01-01T00:00:00.000Z' }),
      createProcess({ id: 'C', lastEventAt: '2025-02-01T00:00:00.000Z' }),
    ] as const

    const descResult = sortDashboardProcesses(baseline, { field: 'createdAt', direction: 'desc' })
    const ascResult = sortDashboardProcesses(baseline, { field: 'createdAt', direction: 'asc' })

    expect(descResult.map((process) => process.id)).toEqual(['A', 'C', 'B'])
    expect(ascResult.map((process) => process.id)).toEqual(['B', 'C', 'A'])
  })

  it('sorts created date using dominantAlertCreatedAt when present', () => {
    const baseline = [
      // lastEventAt intentionally differs to ensure dominantAlertCreatedAt takes precedence
      createProcess({
        id: 'A',
        lastEventAt: '2025-03-01T00:00:00.000Z',
        dominantAlertCreatedAt: '2025-01-01T00:00:00.000Z',
      }),
      createProcess({
        id: 'B',
        lastEventAt: '2025-01-01T00:00:00.000Z',
        dominantAlertCreatedAt: '2025-03-01T00:00:00.000Z',
      }),
      createProcess({
        id: 'C',
        lastEventAt: '2025-02-01T00:00:00.000Z',
        dominantAlertCreatedAt: '2025-02-01T00:00:00.000Z',
      }),
    ] as const

    const descResult = sortDashboardProcesses(baseline, { field: 'createdAt', direction: 'desc' })
    const ascResult = sortDashboardProcesses(baseline, { field: 'createdAt', direction: 'asc' })

    // Expect ordering driven by dominantAlertCreatedAt, not lastEventAt
    expect(descResult.map((process) => process.id)).toEqual(['B', 'C', 'A'])
    expect(ascResult.map((process) => process.id)).toEqual(['A', 'C', 'B'])
  })

  it('sorts status by statusRank instead of label text', () => {
    const baseline = [
      createProcess({ id: 'A', status: 'released', statusRank: 5 }),
      createProcess({ id: 'B', status: 'delivered', statusRank: 7 }),
      createProcess({ id: 'C', status: 'in-transit', statusRank: 3 }),
    ] as const

    const descResult = sortDashboardProcesses(baseline, { field: 'status', direction: 'desc' })
    const ascResult = sortDashboardProcesses(baseline, { field: 'status', direction: 'asc' })

    expect(descResult.map((process) => process.id)).toEqual(['B', 'A', 'C'])
    expect(ascResult.map((process) => process.id)).toEqual(['C', 'A', 'B'])
  })

  it('sorts ETA by etaMsOrNull and keeps null values at the end in both directions', () => {
    const baseline = [
      createProcess({ id: 'A', eta: '2025-03-01T00:00:00.000Z', etaMsOrNull: 1740787200000 }),
      createProcess({ id: 'B', eta: null, etaMsOrNull: null }),
      createProcess({ id: 'C', eta: '2025-02-01T00:00:00.000Z', etaMsOrNull: 1738368000000 }),
    ] as const

    const ascResult = sortDashboardProcesses(baseline, { field: 'eta', direction: 'asc' })
    const descResult = sortDashboardProcesses(baseline, { field: 'eta', direction: 'desc' })

    expect(ascResult.map((process) => process.id)).toEqual(['C', 'A', 'B'])
    expect(descResult.map((process) => process.id)).toEqual(['A', 'C', 'B'])
  })

  it('uses createdAt descending as tie-break when primary field values are equal', () => {
    const baseline = [
      createProcess({
        id: 'A',
        importerName: 'Same',
        lastEventAt: '2025-01-01T00:00:00.000Z',
      }),
      createProcess({
        id: 'B',
        importerName: 'Same',
        lastEventAt: '2025-03-01T00:00:00.000Z',
      }),
      createProcess({
        id: 'C',
        importerName: 'Same',
        lastEventAt: '2025-02-01T00:00:00.000Z',
      }),
    ] as const

    const ascResult = sortDashboardProcesses(baseline, {
      field: 'importerName',
      direction: 'asc',
    })

    expect(ascResult.map((process) => process.id)).toEqual(['B', 'C', 'A'])
  })

  it('uses processNumber asc and processId asc fallback when createdAt tie-break still ties', () => {
    const baseline = createImporterTieBreakProcesses()

    const ascResult = sortDashboardProcesses(baseline, {
      field: 'importerName',
      direction: 'asc',
    })

    expect(ascResult.map((process) => process.id)).toEqual([
      'proc-00',
      'proc-01',
      'proc-02',
      'proc-03',
      'proc-04',
    ])
  })

  it('returns deterministic order when sorting the same dataset repeatedly', () => {
    const baseline = createImporterTieBreakProcesses()

    const sortSelection: DashboardSortSelection = { field: 'importerName', direction: 'asc' }

    const firstRun = sortDashboardProcesses(baseline, sortSelection).map((process) => process.id)
    const secondRun = sortDashboardProcesses(baseline, sortSelection).map((process) => process.id)
    const thirdRun = sortDashboardProcesses(baseline, sortSelection).map((process) => process.id)

    expect(firstRun).toEqual(secondRun)
    expect(secondRun).toEqual(thirdRun)
  })
})
