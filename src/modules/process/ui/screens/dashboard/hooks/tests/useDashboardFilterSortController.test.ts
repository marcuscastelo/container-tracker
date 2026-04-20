import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const emitDashboardSortChangedTelemetryMock = vi.hoisted(() => vi.fn())
const readDashboardFiltersFromLocalStorageMock = vi.hoisted(() => vi.fn())
const writeDashboardFiltersToLocalStorageMock = vi.hoisted(() => vi.fn())
const readDashboardSortFromLocalStorageMock = vi.hoisted(() => vi.fn())
const writeDashboardSortToLocalStorageMock = vi.hoisted(() => vi.fn())

vi.mock('solid-js', async () => vi.importActual('solid-js/dist/solid.js'))

vi.mock('~/modules/process/ui/telemetry/dashboardSort.telemetry', () => ({
  emitDashboardSortChangedTelemetry: emitDashboardSortChangedTelemetryMock,
}))

vi.mock('~/modules/process/ui/validation/dashboardFilterStorage.validation', () => ({
  readDashboardFiltersFromLocalStorage: readDashboardFiltersFromLocalStorageMock,
  writeDashboardFiltersToLocalStorage: writeDashboardFiltersToLocalStorageMock,
}))

vi.mock('~/modules/process/ui/validation/dashboardSortStorage.validation', () => ({
  readDashboardSortFromLocalStorage: readDashboardSortFromLocalStorageMock,
  writeDashboardSortToLocalStorage: writeDashboardSortToLocalStorageMock,
}))

import { createRoot } from 'solid-js'
import { useDashboardFilterSortController } from '~/modules/process/ui/screens/dashboard/hooks/useDashboardFilterSortController'
import { DASHBOARD_DEFAULT_FILTER_SELECTION } from '~/modules/process/ui/viewmodels/dashboard-filter.service'
import { DASHBOARD_DEFAULT_SORT_SELECTION } from '~/modules/process/ui/viewmodels/dashboard-sort.vm'

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function createControllerHarness() {
  return createRoot((dispose) => ({
    controller: useDashboardFilterSortController(),
    dispose,
  }))
}

describe('useDashboardFilterSortController', () => {
  beforeEach(() => {
    emitDashboardSortChangedTelemetryMock.mockReset()
    readDashboardFiltersFromLocalStorageMock.mockReset()
    writeDashboardFiltersToLocalStorageMock.mockReset()
    readDashboardSortFromLocalStorageMock.mockReset()
    writeDashboardSortToLocalStorageMock.mockReset()
    readDashboardSortFromLocalStorageMock.mockReturnValue(DASHBOARD_DEFAULT_SORT_SELECTION)
    readDashboardFiltersFromLocalStorageMock.mockReturnValue(DASHBOARD_DEFAULT_FILTER_SELECTION)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hydrates sort and filters from local storage on mount', async () => {
    readDashboardSortFromLocalStorageMock.mockReturnValue({
      field: 'alerts',
      direction: 'desc',
    })
    readDashboardFiltersFromLocalStorageMock.mockReturnValue({
      providers: ['MSC'],
      statuses: ['IN_TRANSIT'],
      importerId: 'importer-1',
      importerName: 'Acme Imports',
      severity: 'warning',
    })
    const harness = createControllerHarness()

    await flushAsyncWork()

    expect(harness.controller.isHydrated()).toBe(true)
    expect(harness.controller.sortSelection()).toEqual({
      field: 'alerts',
      direction: 'desc',
    })
    expect(harness.controller.filterSelection()).toEqual({
      providers: ['MSC'],
      statuses: ['IN_TRANSIT'],
      importerId: 'importer-1',
      importerName: 'Acme Imports',
      severity: 'warning',
    })

    harness.dispose()
  })

  it('persists sort changes and emits telemetry with the next selection', async () => {
    const harness = createControllerHarness()

    await flushAsyncWork()

    harness.controller.handleSortToggle('eta')

    expect(harness.controller.sortSelection()).toEqual({
      field: 'eta',
      direction: 'asc',
    })
    expect(emitDashboardSortChangedTelemetryMock).toHaveBeenCalledWith('user', 'eta', {
      field: 'eta',
      direction: 'asc',
    })
    expect(writeDashboardSortToLocalStorageMock).toHaveBeenCalledWith({
      field: 'eta',
      direction: 'asc',
    })

    harness.dispose()
  })

  it('persists filter toggles, selects, and clear-all without inventing extra state', async () => {
    const harness = createControllerHarness()

    await flushAsyncWork()

    harness.controller.handleProviderFilterToggle('MSC')
    expect(writeDashboardFiltersToLocalStorageMock).toHaveBeenLastCalledWith({
      providers: ['MSC'],
      statuses: [],
      importerId: null,
      importerName: null,
      severity: null,
    })

    harness.controller.handleStatusFilterToggle('IN_TRANSIT')
    expect(writeDashboardFiltersToLocalStorageMock).toHaveBeenLastCalledWith({
      providers: ['MSC'],
      statuses: ['IN_TRANSIT'],
      importerId: null,
      importerName: null,
      severity: null,
    })

    harness.controller.handleImporterFilterSelect({
      importerId: 'importer-1',
      importerName: 'Acme Imports',
    })
    expect(writeDashboardFiltersToLocalStorageMock).toHaveBeenLastCalledWith({
      providers: ['MSC'],
      statuses: ['IN_TRANSIT'],
      importerId: 'importer-1',
      importerName: 'Acme Imports',
      severity: null,
    })

    harness.controller.handleSeverityFilterSelect('danger')
    expect(writeDashboardFiltersToLocalStorageMock).toHaveBeenLastCalledWith({
      providers: ['MSC'],
      statuses: ['IN_TRANSIT'],
      importerId: 'importer-1',
      importerName: 'Acme Imports',
      severity: 'danger',
    })

    harness.controller.handleClearAllFilters()
    expect(harness.controller.filterSelection()).toEqual(DASHBOARD_DEFAULT_FILTER_SELECTION)
    expect(writeDashboardFiltersToLocalStorageMock).toHaveBeenLastCalledWith(
      DASHBOARD_DEFAULT_FILTER_SELECTION,
    )

    harness.dispose()
  })
})
