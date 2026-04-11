import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchNavbarAlertsSummaryMock = vi.hoisted(() => vi.fn())

vi.mock('solid-js', async () => vi.importActual('solid-js/dist/solid.js'))

vi.mock('~/shared/api/navbar-alerts/navbar-alerts.api', () => ({
  fetchNavbarAlertsSummary: fetchNavbarAlertsSummaryMock,
}))

import { createRoot } from 'solid-js'
import type { NavbarAlertsSummaryData } from '~/shared/api/navbar-alerts/navbar-alerts.contract'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'
import {
  hasResolvedNavbarAlertsResource,
  toNavbarAlertsState,
  useNavbarAlerts,
} from '~/shared/ui/navbar-alerts/useNavbarAlerts'

type Deferred<T> = {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolveDeferred: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolveDeferred = resolve
  })

  if (resolveDeferred === undefined) {
    throw new Error('Failed to create deferred promise')
  }

  return {
    promise,
    resolve: resolveDeferred,
  }
}

function buildNavbarAlertsSummaryData(command?: {
  readonly totalActiveAlerts?: number
  readonly processId?: string
}): NavbarAlertsSummaryData {
  return {
    generated_at: '2026-04-11T12:00:00.000Z',
    total_active_alerts: command?.totalActiveAlerts ?? 1,
    processes: [
      {
        process_id: command?.processId ?? 'process-1',
        process_reference: 'REF-001',
        carrier: 'MSC',
        route_summary: 'Shanghai -> Santos',
        active_alerts_count: command?.totalActiveAlerts ?? 1,
        dominant_severity: 'warning',
        latest_alert_at: '2026-04-10T09:00:00.000Z',
        containers: [
          {
            container_id: 'container-1',
            container_number: 'MSCU1234567',
            status: 'IN_TRANSIT',
            eta: temporalDtoFromCanonical('2026-04-20T00:00:00.000Z'),
            active_alerts_count: command?.totalActiveAlerts ?? 1,
            dominant_severity: 'warning',
            latest_alert_at: '2026-04-10T09:00:00.000Z',
            alerts: [
              {
                alert_id: 'alert-1',
                severity: 'warning',
                category: 'monitoring',
                message_key: 'alerts.etaPassed',
                message_params: {},
                occurred_at: '2026-04-10T09:00:00.000Z',
                retroactive: false,
              },
            ],
          },
        ],
      },
    ],
  }
}

function buildErroredNavbarAlertsResource(): Parameters<typeof toNavbarAlertsState>[0] {
  return {
    error: new Error('navbar failed'),
    loading: false,
    state: 'errored',
    get latest(): never {
      throw new Error('navbar alerts resource latest should not be read')
    },
  }
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function createHookHarness() {
  return createRoot((dispose) => ({
    hook: useNavbarAlerts(),
    dispose,
  }))
}

describe('useNavbarAlerts helpers', () => {
  it('builds a safe error state without reading the throwing resource accessor', () => {
    const resource = buildErroredNavbarAlertsResource()

    expect(toNavbarAlertsState(resource)).toEqual({
      totalAlerts: 0,
      processes: [],
      loading: false,
      error: 'navbar failed',
    })
    expect(hasResolvedNavbarAlertsResource(resource)).toBe(true)
  })
})

describe('useNavbarAlerts', () => {
  beforeEach(() => {
    fetchNavbarAlertsSummaryMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads alerts with cached preference first, then refreshes against the server snapshot', async () => {
    const initialLoad = createDeferred<NavbarAlertsSummaryData>()
    fetchNavbarAlertsSummaryMock
      .mockReturnValueOnce(initialLoad.promise)
      .mockResolvedValueOnce(buildNavbarAlertsSummaryData({ totalActiveAlerts: 2 }))
    const harness = createHookHarness()

    await flushAsyncWork()

    expect(fetchNavbarAlertsSummaryMock).toHaveBeenNthCalledWith(1, { preferCached: true })
    expect(harness.hook.state().loading).toBe(true)
    expect(harness.hook.hasResolved()).toBe(false)

    initialLoad.resolve(buildNavbarAlertsSummaryData())
    await flushAsyncWork()

    expect(harness.hook.state()).toMatchObject({
      totalAlerts: 1,
      loading: false,
      error: null,
    })
    expect(harness.hook.state().processes[0]?.processId).toBe('process-1')
    expect(harness.hook.hasResolved()).toBe(true)

    await harness.hook.refresh()
    await flushAsyncWork()

    expect(fetchNavbarAlertsSummaryMock).toHaveBeenNthCalledWith(2, { preferCached: false })
    expect(harness.hook.state()).toMatchObject({
      totalAlerts: 2,
      loading: false,
      error: null,
    })

    harness.dispose()
  })

  it('exposes backend failures as an explicit error state and marks the resource as resolved', async () => {
    fetchNavbarAlertsSummaryMock.mockRejectedValueOnce(new Error('network down'))
    const harness = createHookHarness()

    await flushAsyncWork()

    expect(harness.hook.state()).toEqual({
      totalAlerts: 0,
      processes: [],
      loading: false,
      error: 'network down',
    })
    expect(harness.hook.hasResolved()).toBe(true)

    harness.dispose()
  })
})
