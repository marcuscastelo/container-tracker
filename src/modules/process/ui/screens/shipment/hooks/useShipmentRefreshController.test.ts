import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { Instant } from '~/shared/time/instant'

const refreshShipmentTrackingMock = vi.hoisted(() => vi.fn())
const useSyncRealtimeCoordinatorMock = vi.hoisted(() => vi.fn(() => () => Instant.fromEpochMs(0)))

vi.mock('~/modules/process/ui/screens/shipment/usecases/refreshShipmentTracking.usecase', () => ({
  refreshShipmentTracking: refreshShipmentTrackingMock,
}))

vi.mock('~/modules/process/ui/utils/sync-realtime-coordinator', () => ({
  useSyncRealtimeCoordinator: useSyncRealtimeCoordinatorMock,
}))

import { useShipmentRefreshController } from '~/modules/process/ui/screens/shipment/hooks/useShipmentRefreshController'

function emptyAlertIncidents(): ShipmentDetailVM['alertIncidents'] {
  return {
    summary: {
      activeIncidents: 0,
      affectedContainers: 0,
      recognizedIncidents: 0,
    },
    active: [],
    recognized: [],
  }
}

function buildShipment(): ShipmentDetailVM {
  return {
    id: 'process-1',
    trackingFreshnessToken: 'freshness-1',
    processRef: 'REF-1',
    reference: 'REF-1',
    carrier: 'MSC',
    bill_of_lading: null,
    booking_number: null,
    importer_name: null,
    exporter_name: null,
    reference_importer: null,
    depositary: null,
    product: null,
    redestination_number: null,
    origin: 'Shanghai',
    destination: 'Santos',
    status: 'in-transit',
    statusCode: 'IN_TRANSIT',
    statusMicrobadge: null,
    eta: null,
    processEtaDisplayVm: {
      kind: 'unavailable',
    },
    processEtaSecondaryVm: {
      visible: false,
      date: null,
      withEta: 0,
      total: 0,
      incomplete: false,
    },
    trackingValidation: {
      hasIssues: false,
      highestSeverity: null,
      affectedContainerCount: 0,
      topIssue: null,
    },
    containers: [],
    alerts: [],
    alertIncidents: emptyAlertIncidents(),
  }
}

function createRefreshHarness() {
  return createRoot((dispose) => {
    const [shipment, setShipment] = createSignal<ShipmentDetailVM | null | undefined>(
      buildShipment(),
    )
    const reconcileTrackingView = vi.fn(() => Promise.resolve())
    const controller = useShipmentRefreshController({
      shipment,
      reconcileTrackingView,
    })

    return {
      controller,
      setShipment,
      reconcileTrackingView,
      dispose,
    }
  })
}

describe('useShipmentRefreshController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-10T10:00:00.000Z'))
    refreshShipmentTrackingMock.mockReset()
    useSyncRealtimeCoordinatorMock.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('delegates refresh orchestration and soft-blocks repeated refreshes after a recent completion', async () => {
    refreshShipmentTrackingMock.mockImplementation(
      async (command: { readonly setLastRefreshDoneAt: (value: Instant | null) => void }) => {
        command.setLastRefreshDoneAt(Instant.fromEpochMs(Date.now()))
      },
    )
    const harness = createRefreshHarness()

    await harness.controller.triggerRefresh()

    expect(refreshShipmentTrackingMock).toHaveBeenCalledTimes(1)
    expect(refreshShipmentTrackingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: buildShipment(),
        refreshTrackingData: harness.reconcileTrackingView,
      }),
    )

    vi.setSystemTime(new Date('2026-04-10T10:00:20.000Z'))
    await harness.controller.triggerRefresh()

    expect(refreshShipmentTrackingMock).toHaveBeenCalledTimes(1)
    expect(harness.controller.refreshHint()).not.toBeNull()
    expect(harness.controller.refreshError()).toBeNull()

    harness.dispose()
  })

  it('clears active realtime cleanup when reset or explicit cleanup is requested', async () => {
    const realtimeCleanup = vi.fn()
    refreshShipmentTrackingMock.mockImplementation(
      async (command: {
        readonly setRefreshError: (value: string | null) => void
        readonly setRefreshHint: (value: string | null) => void
        readonly setRefreshRetry: (
          value: { readonly current: number; readonly total: number } | null,
        ) => void
        readonly setRealtimeCleanup: (cleanup: (() => void) | null) => void
      }) => {
        command.setRefreshError('temporary failure')
        command.setRefreshHint('temporary hint')
        command.setRefreshRetry({ current: 1, total: 5 })
        command.setRealtimeCleanup(realtimeCleanup)
      },
    )
    const harness = createRefreshHarness()

    await harness.controller.triggerRefresh()
    expect(harness.controller.refreshError()).toBe('temporary failure')
    expect(harness.controller.refreshHint()).toBe('temporary hint')
    expect(harness.controller.refreshRetry()).toEqual({ current: 1, total: 5 })

    harness.controller.resetRefreshState()

    expect(realtimeCleanup).toHaveBeenCalledTimes(1)
    expect(harness.controller.refreshError()).toBeNull()
    expect(harness.controller.refreshHint()).toBeNull()
    expect(harness.controller.refreshRetry()).toBeNull()
    expect(harness.controller.isRefreshing()).toBe(false)

    await harness.controller.triggerRefresh()
    harness.controller.cleanupRealtime()

    expect(realtimeCleanup).toHaveBeenCalledTimes(2)

    harness.dispose()
  })

  it('clears error and hint without changing shipment data or realtime state', async () => {
    refreshShipmentTrackingMock.mockImplementation(
      async (command: {
        readonly setRefreshError: (value: string | null) => void
        readonly setRefreshHint: (value: string | null) => void
      }) => {
        command.setRefreshError('failed')
        command.setRefreshHint('hint')
      },
    )
    const harness = createRefreshHarness()

    await harness.controller.triggerRefresh()
    harness.controller.clearRefreshError()

    expect(harness.controller.refreshError()).toBeNull()
    expect(harness.controller.refreshHint()).toBeNull()

    harness.dispose()
  })
})
