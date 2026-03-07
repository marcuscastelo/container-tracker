import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_DEFAULT_FILTER_SELECTION,
  type DashboardFilterSelection,
  deriveDashboardImporterFilterOptions,
  deriveDashboardProviderFilterOptions,
  deriveDashboardSeverityFilterOptions,
  deriveDashboardStatusFilterOptions,
  filterDashboardProcesses,
  hasActiveDashboardFilters,
  setDashboardImporterFilter,
  toggleDashboardProviderFilter,
  toggleDashboardStatusFilter,
} from '~/modules/process/ui/viewmodels/dashboard-filter-interaction.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'

function createProcess(
  input: Pick<ProcessSummaryVM, 'id' | 'statusCode'> & {
    readonly carrier?: string | null
    readonly importerId?: string | null
    readonly importerName?: string | null
    readonly highestAlertSeverity?: ProcessSummaryVM['highestAlertSeverity']
  },
): ProcessSummaryVM {
  return {
    id: input.id,
    reference: null,
    origin: null,
    destination: null,
    importerId: input.importerId ?? null,
    importerName: input.importerName ?? null,
    containerCount: 1,
    containerNumbers: [],
    status: 'unknown',
    statusCode: input.statusCode,
    statusRank: 0,
    eta: null,
    etaMsOrNull: null,
    carrier: input.carrier ?? null,
    alertsCount: 0,
    highestAlertSeverity: input.highestAlertSeverity ?? null,
    hasTransshipment: false,
    lastEventAt: null,
    syncStatus: 'idle',
    lastSyncAt: null,
  }
}

function createFilters(input?: {
  readonly providers?: DashboardFilterSelection['providers']
  readonly statuses?: DashboardFilterSelection['statuses']
  readonly importerId?: DashboardFilterSelection['importerId']
  readonly importerName?: DashboardFilterSelection['importerName']
  readonly severity?: DashboardFilterSelection['severity']
}): DashboardFilterSelection {
  return {
    providers: input?.providers ?? DASHBOARD_DEFAULT_FILTER_SELECTION.providers,
    statuses: input?.statuses ?? DASHBOARD_DEFAULT_FILTER_SELECTION.statuses,
    importerId: input?.importerId ?? DASHBOARD_DEFAULT_FILTER_SELECTION.importerId,
    importerName: input?.importerName ?? DASHBOARD_DEFAULT_FILTER_SELECTION.importerName,
    severity: input?.severity ?? DASHBOARD_DEFAULT_FILTER_SELECTION.severity,
  }
}

describe('dashboard filter interactions', () => {
  it('toggles provider values on and off', () => {
    const firstToggle = toggleDashboardProviderFilter(DASHBOARD_DEFAULT_FILTER_SELECTION, 'MAERSK')
    const secondToggle = toggleDashboardProviderFilter(firstToggle, 'HAPAG')
    const removeFirst = toggleDashboardProviderFilter(secondToggle, 'MAERSK')

    expect(firstToggle.providers).toEqual(['MAERSK'])
    expect(secondToggle.providers).toEqual(['MAERSK', 'HAPAG'])
    expect(removeFirst.providers).toEqual(['HAPAG'])
  })

  it('toggles canonical status values on and off', () => {
    const firstToggle = toggleDashboardStatusFilter(DASHBOARD_DEFAULT_FILTER_SELECTION, 'LOADED')
    const secondToggle = toggleDashboardStatusFilter(firstToggle, 'IN_TRANSIT')
    const removeFirst = toggleDashboardStatusFilter(secondToggle, 'LOADED')

    expect(firstToggle.statuses).toEqual(['LOADED'])
    expect(secondToggle.statuses).toEqual(['LOADED', 'IN_TRANSIT'])
    expect(removeFirst.statuses).toEqual(['IN_TRANSIT'])
  })

  it('derives provider options from dataset with pt-BR stable sorting and counts', () => {
    const processes = [
      createProcess({ id: 'A', carrier: 'maersk', statusCode: 'UNKNOWN' }),
      createProcess({ id: 'B', carrier: 'Ágil', statusCode: 'UNKNOWN' }),
      createProcess({ id: 'C', carrier: 'MAERSK', statusCode: 'UNKNOWN' }),
      createProcess({ id: 'D', carrier: ' ', statusCode: 'UNKNOWN' }),
      createProcess({ id: 'E', carrier: null, statusCode: 'UNKNOWN' }),
      createProcess({ id: 'F', carrier: 'Ágil', statusCode: 'UNKNOWN' }),
    ] as const

    const options = deriveDashboardProviderFilterOptions(processes)

    expect(options).toEqual([
      { value: 'Ágil', count: 2 },
      { value: 'maersk', count: 1 },
      { value: 'MAERSK', count: 1 },
    ])
  })

  it('derives status options in canonical status order', () => {
    const processes = [
      createProcess({ id: 'A', carrier: null, statusCode: 'DELIVERED' }),
      createProcess({ id: 'B', carrier: null, statusCode: 'IN_PROGRESS' }),
      createProcess({ id: 'C', carrier: null, statusCode: 'DELIVERED' }),
      createProcess({ id: 'D', carrier: null, statusCode: 'LOADED' }),
    ] as const

    const options = deriveDashboardStatusFilterOptions(processes)

    expect(options).toEqual([
      { value: 'IN_PROGRESS', count: 1 },
      { value: 'LOADED', count: 1 },
      { value: 'DELIVERED', count: 2 },
    ])
  })

  it('derives importer options from dataset with id-first deduplication and counts', () => {
    const processes = [
      createProcess({
        id: 'A',
        statusCode: 'UNKNOWN',
        importerId: 'importer-7',
        importerName: 'Empresa Alpha',
      }),
      createProcess({
        id: 'B',
        statusCode: 'UNKNOWN',
        importerId: 'importer-7',
        importerName: 'Empresa Alpha',
      }),
      createProcess({
        id: 'C',
        statusCode: 'UNKNOWN',
        importerName: 'Mercury Trade',
      }),
      createProcess({
        id: 'D',
        statusCode: 'UNKNOWN',
        importerName: '  mercury trade  ',
      }),
      createProcess({
        id: 'E',
        statusCode: 'UNKNOWN',
        importerId: 'importer-8',
      }),
      createProcess({
        id: 'F',
        statusCode: 'UNKNOWN',
        importerName: '  ',
      }),
    ] as const

    const options = deriveDashboardImporterFilterOptions(processes)

    expect(options).toEqual([
      {
        importerId: 'importer-7',
        importerName: 'Empresa Alpha',
        label: 'Empresa Alpha (importer-7)',
        count: 2,
      },
      {
        importerId: 'importer-8',
        importerName: 'importer-8',
        label: 'importer-8',
        count: 1,
      },
      {
        importerId: null,
        importerName: 'Mercury Trade',
        label: 'Mercury Trade',
        count: 2,
      },
    ])
  })

  it('sets importer selection while preserving provider and status filters', () => {
    const currentSelection = createFilters({
      providers: ['MAERSK'],
      statuses: ['IN_TRANSIT'],
    })

    const updatedSelection = setDashboardImporterFilter(currentSelection, {
      importerId: 'importer-9',
      importerName: 'Empresa Delta',
    })
    const clearedSelection = setDashboardImporterFilter(updatedSelection, null)

    expect(updatedSelection).toEqual({
      providers: ['MAERSK'],
      statuses: ['IN_TRANSIT'],
      importerId: 'importer-9',
      importerName: 'Empresa Delta',
      severity: null,
    })
    expect(clearedSelection).toEqual({
      providers: ['MAERSK'],
      statuses: ['IN_TRANSIT'],
      importerId: null,
      importerName: null,
      severity: null,
    })
  })
})

describe('dashboard process filtering', () => {
  it('detects active filters only for non-empty provider/status/importer values', () => {
    expect(hasActiveDashboardFilters(DASHBOARD_DEFAULT_FILTER_SELECTION)).toBe(false)
    expect(
      hasActiveDashboardFilters(
        createFilters({
          providers: ['MAERSK'],
        }),
      ),
    ).toBe(true)
    expect(
      hasActiveDashboardFilters(
        createFilters({
          statuses: ['IN_TRANSIT'],
        }),
      ),
    ).toBe(true)
    expect(
      hasActiveDashboardFilters(
        createFilters({
          importerName: '   ',
        }),
      ),
    ).toBe(false)
    expect(
      hasActiveDashboardFilters(
        createFilters({
          importerId: 'importer-42',
        }),
      ),
    ).toBe(true)
  })

  it('keeps baseline order untouched when no filters are selected', () => {
    const baseline = [
      createProcess({ id: 'A', carrier: 'MAERSK', statusCode: 'IN_TRANSIT' }),
      createProcess({ id: 'B', carrier: 'HAPAG', statusCode: 'LOADED' }),
    ] as const

    const result = filterDashboardProcesses(baseline, DASHBOARD_DEFAULT_FILTER_SELECTION)

    expect(result).toBe(baseline)
  })

  it('applies exact provider matching when provider filters are selected', () => {
    const baseline = [
      createProcess({ id: 'A', carrier: 'MAERSK', statusCode: 'IN_TRANSIT' }),
      createProcess({ id: 'B', carrier: 'maersk', statusCode: 'IN_TRANSIT' }),
      createProcess({ id: 'C', carrier: 'HAPAG', statusCode: 'IN_TRANSIT' }),
    ] as const

    const result = filterDashboardProcesses(
      baseline,
      createFilters({ providers: ['maersk'], statuses: [] }),
    )

    expect(result.map((process) => process.id)).toEqual(['B'])
  })

  it('combines provider and status filters with logical intersection', () => {
    const baseline = [
      createProcess({ id: 'A', carrier: 'MAERSK', statusCode: 'IN_TRANSIT' }),
      createProcess({ id: 'B', carrier: 'MAERSK', statusCode: 'LOADED' }),
      createProcess({ id: 'C', carrier: 'HAPAG', statusCode: 'IN_TRANSIT' }),
    ] as const

    const result = filterDashboardProcesses(
      baseline,
      createFilters({
        providers: ['MAERSK'],
        statuses: ['IN_TRANSIT'],
      }),
    )

    expect(result.map((process) => process.id)).toEqual(['A'])
  })

  it('matches importer filter by importerId when provided and falls back to normalized importerName', () => {
    const baseline = [
      createProcess({
        id: 'A',
        carrier: 'MAERSK',
        statusCode: 'IN_TRANSIT',
        importerId: 'importer-1',
        importerName: 'Empresa Alpha',
      }),
      createProcess({
        id: 'B',
        carrier: 'MAERSK',
        statusCode: 'IN_TRANSIT',
        importerId: null,
        importerName: ' empresa alpha ',
      }),
      createProcess({
        id: 'C',
        carrier: 'MAERSK',
        statusCode: 'IN_TRANSIT',
        importerId: 'importer-2',
        importerName: 'Empresa Beta',
      }),
    ] as const

    const byImporterId = filterDashboardProcesses(
      baseline,
      createFilters({
        importerId: 'importer-1',
        importerName: 'Empresa Alpha',
      }),
    )
    const byImporterName = filterDashboardProcesses(
      baseline,
      createFilters({
        importerName: 'EMPRESA ALPHA',
      }),
    )

    expect(byImporterId.map((process) => process.id)).toEqual(['A'])
    expect(byImporterName.map((process) => process.id)).toEqual(['A', 'B'])
  })
})

it('derives severity options and filters by severity', () => {
  const processes = [
    createProcess({ id: 'A', statusCode: 'UNKNOWN', highestAlertSeverity: 'danger' }),
    createProcess({ id: 'B', statusCode: 'UNKNOWN', highestAlertSeverity: 'warning' }),
    createProcess({ id: 'C', statusCode: 'UNKNOWN', highestAlertSeverity: null }),
  ] as const

  const options = deriveDashboardSeverityFilterOptions(processes)
  expect(options).toEqual([
    { value: 'danger', count: 1 },
    { value: 'warning', count: 1 },
    { value: 'none', count: 1 },
  ])

  const filtered = filterDashboardProcesses(processes, createFilters({ severity: 'danger' }))
  expect(filtered.map((p) => p.id)).toEqual(['A'])

  // hasActiveDashboardFilters should consider severity selection as active
  expect(hasActiveDashboardFilters(createFilters({ severity: 'warning' }))).toBe(true)
})
