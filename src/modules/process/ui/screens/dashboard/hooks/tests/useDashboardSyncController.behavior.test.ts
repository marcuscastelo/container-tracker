import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'

const fetchProcessesSyncStatusMock = vi.hoisted(() => vi.fn())
const syncAllProcessesRequestMock = vi.hoisted(() => vi.fn())
const syncProcessRequestMock = vi.hoisted(() => vi.fn())
const refreshDashboardDataMock = vi.hoisted(() => vi.fn())
const realtimeState = vi.hoisted(() => ({
  current: {},
}))

vi.mock('solid-js', async () => vi.importActual('solid-js/dist/solid.js'))

vi.mock('~/modules/process/ui/api/processSync.api', () => ({
  fetchProcessesSyncStatus: fetchProcessesSyncStatusMock,
  syncAllProcessesRequest: syncAllProcessesRequestMock,
  syncProcessRequest: syncProcessRequestMock,
}))

vi.mock('~/modules/process/ui/hooks/useProcessSyncRealtime', () => ({
  useProcessSyncRealtime: () => () => realtimeState.current,
}))

vi.mock('~/modules/process/ui/utils/dashboard-refresh', () => ({
  refreshDashboardData: refreshDashboardDataMock,
}))

import { createRoot } from 'solid-js'
import { useDashboardSyncController } from '~/modules/process/ui/screens/dashboard/hooks/useDashboardSyncController'

type Deferred<T> = {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (reason: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolveDeferred: ((value: T) => void) | undefined
  let rejectDeferred: ((reason: unknown) => void) | undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve
    rejectDeferred = reject
  })

  if (resolveDeferred === undefined || rejectDeferred === undefined) {
    throw new Error('Failed to create deferred promise')
  }

  return {
    promise,
    resolve: resolveDeferred,
    reject: rejectDeferred,
  }
}

function buildProcess(id: string, syncStatus: ProcessSummaryVM['syncStatus']): ProcessSummaryVM {
  return {
    id,
    reference: `REF-${id}`,
    origin: {
      display_name: 'Shanghai',
    },
    destination: {
      display_name: 'Santos',
    },
    importerId: null,
    importerName: null,
    exporterName: null,
    containerCount: 1,
    containerNumbers: ['MSCU1234567'],
    status: 'in-transit',
    statusCode: 'IN_TRANSIT',
    statusMicrobadge: null,
    statusRank: 1,
    eta: null,
    etaDisplay: {
      kind: 'unavailable',
    },
    etaMsOrNull: null,
    carrier: 'MSC',
    alertsCount: 0,
    highestAlertSeverity: null,
    attentionSeverity: null,
    dominantAlertCreatedAt: null,
    trackingValidation: {
      hasIssues: false,
      highestSeverity: null,
      affectedContainerCount: 0,
      topIssue: null,
    },
    redestinationNumber: null,
    hasTransshipment: false,
    lastEventAt: null,
    syncStatus,
    lastSyncAt: null,
  }
}

function createControllerHarness(processes: readonly ProcessSummaryVM[]) {
  return createRoot((dispose) => {
    const refetchProcesses = vi.fn()
    const controller = useDashboardSyncController({
      allProcesses: () => processes,
      sortedProcesses: () => processes,
      refetchProcesses,
      refetchGlobalAlerts: vi.fn(),
      refetchDashboardKpis: vi.fn(),
      refetchDashboardProcessesCreatedByMonth: vi.fn(),
    })

    return {
      controller,
      refetchProcesses,
      dispose,
    }
  })
}

describe('useDashboardSyncController behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    fetchProcessesSyncStatusMock.mockReset()
    syncAllProcessesRequestMock.mockReset()
    syncProcessRequestMock.mockReset()
    refreshDashboardDataMock.mockReset()
    realtimeState.current = {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('shows process-level syncing immediately, then success, then expires local feedback', async () => {
    const syncDeferred = createDeferred<void>()
    syncProcessRequestMock.mockReturnValue(syncDeferred.promise)
    const harness = createControllerHarness([buildProcess('process-1', 'idle')])

    const syncPromise = harness.controller.handleProcessSync('process-1')

    expect(harness.controller.processesWithSyncFeedback()[0]?.syncStatus).toBe('syncing')

    syncDeferred.resolve()
    await syncPromise

    expect(syncProcessRequestMock).toHaveBeenCalledWith('process-1')
    expect(harness.refetchProcesses).toHaveBeenCalledTimes(1)
    expect(harness.controller.processesWithSyncFeedback()[0]?.syncStatus).toBe('success')

    await vi.advanceTimersByTimeAsync(2_600)

    expect(harness.controller.processesWithSyncFeedback()[0]?.syncStatus).toBe('idle')
    harness.dispose()
  })

  it('marks all current rows with transient success after dashboard refresh', async () => {
    refreshDashboardDataMock.mockResolvedValue(undefined)
    const harness = createControllerHarness([
      buildProcess('process-1', 'idle'),
      buildProcess('process-2', 'idle'),
    ])

    await harness.controller.handleDashboardRefresh()

    expect(refreshDashboardDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        syncAllProcesses: syncAllProcessesRequestMock,
      }),
    )
    expect(
      harness.controller.processesWithSyncFeedback().map((process) => process.syncStatus),
    ).toEqual(['success', 'success'])

    await vi.advanceTimersByTimeAsync(2_600)

    expect(
      harness.controller.processesWithSyncFeedback().map((process) => process.syncStatus),
    ).toEqual(['idle', 'idle'])
    harness.dispose()
  })

  it('keeps server state authoritative after process sync failure and exposes transient error feedback', async () => {
    syncProcessRequestMock.mockRejectedValue(new Error('sync failed'))
    const harness = createControllerHarness([buildProcess('process-1', 'idle')])

    await harness.controller.handleProcessSync('process-1')

    expect(harness.refetchProcesses).toHaveBeenCalledTimes(1)
    expect(harness.controller.processesWithSyncFeedback()[0]?.syncStatus).toBe('error')

    await vi.advanceTimersByTimeAsync(2_600)

    expect(harness.controller.processesWithSyncFeedback()[0]?.syncStatus).toBe('idle')
    harness.dispose()
  })
})
