import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  SyncAllProcessesBusinessErrorResponse,
  SyncAllProcessesRequestResult,
  SyncAllProcessesSuccessResponse,
} from '~/modules/process/ui/api/processSync.api'
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
    activeIncidentCount: 0,
    affectedContainerCount: 0,
    recognizedIncidentCount: 0,
    dominantIncident: null,
    attentionSeverity: null,
    trackingValidation: {
      hasIssues: false,
      highestSeverity: null,
      affectedContainerCount: 0,
      topIssue: null,
    },
    redestinationNumber: null,
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

function buildSyncAllSuccessPayload(): SyncAllProcessesSuccessResponse {
  return {
    ok: true,
    summary: {
      requestedProcesses: 3,
      requestedContainers: 4,
      enqueued: 2,
      skipped: 1,
      failed: 1,
    },
    enqueuedTargets: [
      {
        processId: 'process-1',
        processReference: 'REF-process-1',
        containerNumber: 'MSCU1234567',
        provider: 'msc',
        syncRequestId: 'sync-request-1',
      },
      {
        processId: 'process-2',
        processReference: 'REF-process-2',
        containerNumber: 'MSCU7654321',
        provider: 'maersk',
        syncRequestId: 'sync-request-2',
      },
    ],
    skippedTargets: [
      {
        processId: 'process-2',
        processReference: 'REF-process-2',
        containerNumber: 'HLCU2222222',
        provider: 'hapag',
        reasonCode: 'UNSUPPORTED_PROVIDER',
        reasonMessage: 'Provider is not supported for dashboard sync',
      },
    ],
    failedTargets: [
      {
        processId: 'process-3',
        processReference: 'REF-process-3',
        containerNumber: 'SEGU3333333',
        provider: 'maersk',
        reasonCode: 'ENQUEUE_FAILED',
        reasonMessage: 'Failed to enqueue target',
      },
    ],
  }
}

function buildSyncAllBusinessErrorPayload(): SyncAllProcessesBusinessErrorResponse {
  return {
    ok: false,
    error: 'sync_dashboard_failed_no_targets_enqueued',
    summary: {
      requestedProcesses: 2,
      requestedContainers: 2,
      enqueued: 0,
      skipped: 1,
      failed: 1,
    },
    enqueuedTargets: [],
    skippedTargets: [
      {
        processId: 'process-1',
        processReference: 'REF-process-1',
        containerNumber: 'MSCU1234567',
        provider: 'hapag',
        reasonCode: 'UNSUPPORTED_PROVIDER',
        reasonMessage: 'Provider is not supported for dashboard sync',
      },
    ],
    failedTargets: [
      {
        processId: 'process-2',
        processReference: 'REF-process-2',
        containerNumber: 'MSCU7654321',
        provider: 'maersk',
        reasonCode: 'ENQUEUE_FAILED',
        reasonMessage: 'Failed to enqueue target',
      },
    ],
  }
}

function buildSyncAllSuccessResult(): SyncAllProcessesRequestResult {
  return {
    httpStatus: 200,
    payload: buildSyncAllSuccessPayload(),
  }
}

function buildSyncAllBusinessErrorResult(): SyncAllProcessesRequestResult {
  return {
    httpStatus: 422,
    payload: buildSyncAllBusinessErrorPayload(),
  }
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

  it('shows process-level syncing immediately, then keeps success visible for 30 seconds', async () => {
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

    expect(harness.controller.processesWithSyncFeedback()[0]?.syncStatus).toBe('success')

    await vi.advanceTimersByTimeAsync(27_500)

    expect(harness.controller.processesWithSyncFeedback()[0]?.syncStatus).toBe('idle')
    harness.dispose()
  })

  it('shows partial success details, keeps row issues, and dismisses only the inline panel', async () => {
    refreshDashboardDataMock.mockResolvedValue(buildSyncAllSuccessResult())
    const harness = createControllerHarness([
      buildProcess('process-1', 'idle'),
      buildProcess('process-2', 'idle'),
      buildProcess('process-3', 'idle'),
    ])

    await harness.controller.handleDashboardRefresh()

    expect(refreshDashboardDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        syncAllProcesses: syncAllProcessesRequestMock,
      }),
    )
    expect(harness.controller.dashboardSyncBatchResult()).toMatchObject({
      httpStatus: 200,
      isBusinessError: false,
      tone: 'danger',
      summary: {
        requestedProcesses: 3,
        requestedContainers: 4,
        enqueued: 2,
        skipped: 1,
        failed: 1,
      },
    })
    expect(
      harness.controller.processesWithSyncFeedback().map((process) => ({
        id: process.id,
        syncStatus: process.syncStatus,
        issue: process.syncIssue?.severity ?? null,
      })),
    ).toEqual([
      {
        id: 'process-1',
        syncStatus: 'success',
        issue: null,
      },
      {
        id: 'process-2',
        syncStatus: 'success',
        issue: 'warning',
      },
      {
        id: 'process-3',
        syncStatus: 'error',
        issue: 'danger',
      },
    ])

    await vi.advanceTimersByTimeAsync(2_600)

    expect(
      harness.controller.processesWithSyncFeedback().map((process) => ({
        id: process.id,
        syncStatus: process.syncStatus,
        issue: process.syncIssue?.severity ?? null,
      })),
    ).toEqual([
      {
        id: 'process-1',
        syncStatus: 'success',
        issue: null,
      },
      {
        id: 'process-2',
        syncStatus: 'success',
        issue: 'warning',
      },
      {
        id: 'process-3',
        syncStatus: 'idle',
        issue: 'danger',
      },
    ])

    await vi.advanceTimersByTimeAsync(27_500)

    expect(
      harness.controller.processesWithSyncFeedback().map((process) => ({
        id: process.id,
        syncStatus: process.syncStatus,
        issue: process.syncIssue?.severity ?? null,
      })),
    ).toEqual([
      {
        id: 'process-1',
        syncStatus: 'idle',
        issue: null,
      },
      {
        id: 'process-2',
        syncStatus: 'idle',
        issue: 'warning',
      },
      {
        id: 'process-3',
        syncStatus: 'idle',
        issue: 'danger',
      },
    ])

    harness.controller.dismissDashboardSyncBatchResult()

    expect(harness.controller.dashboardSyncBatchResult()).toBeNull()
    expect(harness.controller.processesWithSyncFeedback()[1]?.syncIssue?.severity).toBe('warning')
    expect(harness.controller.processesWithSyncFeedback()[2]?.syncIssue?.severity).toBe('danger')
    harness.dispose()
  })

  it('treats structured 422 responses as business results instead of total failure', async () => {
    refreshDashboardDataMock.mockResolvedValue(buildSyncAllBusinessErrorResult())
    const harness = createControllerHarness([
      buildProcess('process-1', 'idle'),
      buildProcess('process-2', 'idle'),
    ])

    await expect(harness.controller.handleDashboardRefresh()).resolves.toBeUndefined()

    expect(harness.controller.dashboardSyncBatchResult()).toMatchObject({
      httpStatus: 422,
      isBusinessError: true,
      tone: 'danger',
      summary: {
        requestedProcesses: 2,
        requestedContainers: 2,
        enqueued: 0,
        skipped: 1,
        failed: 1,
      },
    })
    expect(
      harness.controller.processesWithSyncFeedback().map((process) => ({
        id: process.id,
        syncStatus: process.syncStatus,
        issue: process.syncIssue?.severity ?? null,
      })),
    ).toEqual([
      {
        id: 'process-1',
        syncStatus: 'idle',
        issue: 'warning',
      },
      {
        id: 'process-2',
        syncStatus: 'error',
        issue: 'danger',
      },
    ])
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
