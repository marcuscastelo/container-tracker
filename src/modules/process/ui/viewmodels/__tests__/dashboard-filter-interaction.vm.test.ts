import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_DEFAULT_FILTER_SELECTION,
  type DashboardFilterSelection,
  deriveDashboardProviderFilterOptions,
  deriveDashboardStatusFilterOptions,
  filterDashboardProcesses,
  toggleDashboardProviderFilter,
  toggleDashboardStatusFilter,
} from '~/modules/process/ui/viewmodels/dashboard-filter-interaction.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'

function createProcess(
  input: Pick<ProcessSummaryVM, 'id' | 'statusCode'> & {
    readonly carrier?: string | null
  },
): ProcessSummaryVM {
  return {
    id: input.id,
    reference: null,
    origin: null,
    destination: null,
    importerId: null,
    importerName: null,
    containerCount: 1,
    status: 'unknown',
    statusCode: input.statusCode,
    statusRank: 0,
    eta: null,
    etaMsOrNull: null,
    carrier: input.carrier ?? null,
    alertsCount: 0,
    highestAlertSeverity: null,
    hasTransshipment: false,
    lastEventAt: null,
  }
}

function createFilters(input?: {
  readonly providers?: DashboardFilterSelection['providers']
  readonly statuses?: DashboardFilterSelection['statuses']
  readonly importerId?: DashboardFilterSelection['importerId']
  readonly importerName?: DashboardFilterSelection['importerName']
}): DashboardFilterSelection {
  return {
    providers: input?.providers ?? DASHBOARD_DEFAULT_FILTER_SELECTION.providers,
    statuses: input?.statuses ?? DASHBOARD_DEFAULT_FILTER_SELECTION.statuses,
    importerId: input?.importerId ?? DASHBOARD_DEFAULT_FILTER_SELECTION.importerId,
    importerName: input?.importerName ?? DASHBOARD_DEFAULT_FILTER_SELECTION.importerName,
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
})
