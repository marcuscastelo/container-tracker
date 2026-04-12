import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchNavbarAlertsSummaryMock = vi.hoisted(() => vi.fn())

vi.mock('solid-js', async () => vi.importActual('solid-js/dist/solid.js'))

vi.mock('~/shared/api/navbar-alerts/navbar-alerts.api', () => ({
  fetchNavbarAlertsSummary: fetchNavbarAlertsSummaryMock,
}))

import { createRoot } from 'solid-js'
import type { NavbarAlertsSummaryData } from '~/shared/api/navbar-alerts/navbar-alerts.contract'
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
  readonly totalActiveIncidents?: number
  readonly processId?: string
}): NavbarAlertsSummaryData {
  return {
    generated_at: '2026-04-11T12:00:00.000Z',
    total_active_incidents: command?.totalActiveIncidents ?? 1,
    processes: [
      {
        process_id: command?.processId ?? 'process-1',
        process_reference: 'REF-001',
        carrier: 'MSC',
        route_summary: 'Shanghai -> Santos',
        active_incident_count: command?.totalActiveIncidents ?? 1,
        affected_container_count: 1,
        dominant_severity: 'warning',
        latest_incident_at: '2026-04-10T09:00:00.000Z',
        incidents: [
          {
            incident_key: 'ETA_PASSED',
            type: 'ETA_PASSED',
            category: 'eta',
            severity: 'warning',
            fact: {
              message_key: 'incidents.fact.etaPassed',
              message_params: {},
            },
            action: {
              action_key: 'incidents.action.checkEta',
              action_params: {},
              action_kind: 'CHECK_ETA',
            },
            affected_container_count: 1,
            triggered_at: '2026-04-10T09:00:00.000Z',
            containers: [
              {
                container_id: 'container-1',
                container_number: 'MSCU1234567',
                lifecycle_state: 'ACTIVE',
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
      totalActiveIncidents: 0,
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

  it('loads incidents with cached preference first, then refreshes against the server snapshot', async () => {
    const initialLoad = createDeferred<NavbarAlertsSummaryData>()
    fetchNavbarAlertsSummaryMock
      .mockReturnValueOnce(initialLoad.promise)
      .mockResolvedValueOnce(buildNavbarAlertsSummaryData({ totalActiveIncidents: 2 }))
    const harness = createHookHarness()

    await flushAsyncWork()

    expect(fetchNavbarAlertsSummaryMock).toHaveBeenNthCalledWith(1, { preferCached: true })
    expect(harness.hook.state().loading).toBe(true)
    expect(harness.hook.hasResolved()).toBe(false)

    initialLoad.resolve(buildNavbarAlertsSummaryData())
    await flushAsyncWork()

    expect(harness.hook.state()).toMatchObject({
      totalActiveIncidents: 1,
      loading: false,
      error: null,
    })
    expect(harness.hook.state().processes[0]?.processId).toBe('process-1')
    expect(harness.hook.hasResolved()).toBe(true)

    await harness.hook.refresh()
    await flushAsyncWork()

    expect(fetchNavbarAlertsSummaryMock).toHaveBeenNthCalledWith(2, { preferCached: false })
    expect(harness.hook.state()).toMatchObject({
      totalActiveIncidents: 2,
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
      totalActiveIncidents: 0,
      processes: [],
      loading: false,
      error: 'network down',
    })
    expect(harness.hook.hasResolved()).toBe(true)

    harness.dispose()
  })
})
