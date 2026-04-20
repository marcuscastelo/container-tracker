import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RefreshRetryState } from '~/modules/process/ui/screens/shipment/types/shipmentScreen.types'
import type {
  ContainerDetailVM,
  ShipmentDetailVM,
} from '~/modules/process/ui/viewmodels/shipment.vm'
import { Instant } from '~/shared/time/instant'

const fetchWithHttpDegradationReportingMock = vi.hoisted(() => vi.fn())
const pollRefreshSyncStatusMock = vi.hoisted(() => vi.fn())
const realtimeUnsubscribeMock = vi.hoisted(() => vi.fn())
const subscribeToSyncRequestsRealtimeByIdsMock = vi.hoisted(() =>
  vi.fn(() => ({
    unsubscribe: realtimeUnsubscribeMock,
  })),
)

vi.mock('~/shared/api/httpDegradationReporter', () => ({
  fetchWithHttpDegradationReporting: fetchWithHttpDegradationReportingMock,
}))

vi.mock('~/modules/process/ui/utils/refresh-sync-polling', () => ({
  pollRefreshSyncStatus: pollRefreshSyncStatusMock,
}))

vi.mock('~/shared/api/sync-requests.realtime.client', () => ({
  subscribeToSyncRequestsRealtimeByIds: subscribeToSyncRequestsRealtimeByIdsMock,
}))

import { refreshShipmentTracking } from '~/modules/process/ui/screens/shipment/usecases/refreshShipmentTracking.usecase'

const SYNC_REQUEST_ID_1 = '11111111-1111-4111-8111-111111111111'
const SYNC_REQUEST_ID_2 = '22222222-2222-4222-8222-222222222222'

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

function buildContainer(command: {
  readonly id: string
  readonly number: string
}): ContainerDetailVM {
  return {
    id: command.id,
    number: command.number,
    carrierCode: 'MSC',
    status: 'in-transit',
    statusCode: 'IN_TRANSIT',
    sync: {
      containerNumber: command.number,
      carrier: 'MSC',
      state: 'ok',
      relativeTimeAt: null,
      isStale: false,
    },
    eta: null,
    etaChipVm: {
      state: 'UNAVAILABLE',
      tone: 'neutral',
      date: null,
    },
    selectedEtaVm: null,
    currentContext: {
      locationCode: null,
      locationDisplay: null,
      vesselName: null,
      voyage: null,
      vesselVisible: false,
    },
    nextLocation: null,
    tsChipVm: {
      visible: false,
      count: 0,
      portsTooltip: null,
    },
    dataIssueChipVm: {
      visible: false,
    },
    trackingContainment: null,
    trackingValidation: {
      hasIssues: false,
      highestSeverity: null,
      findingCount: 0,
      activeIssues: [],
    },
    transshipment: {
      hasTransshipment: false,
      count: 0,
      ports: [],
    },
    timeline: [],
  }
}

function buildShipment(containers: readonly ContainerDetailVM[]): ShipmentDetailVM {
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
      total: containers.length,
      incomplete: containers.length > 0,
    },
    trackingValidation: {
      hasIssues: false,
      highestSeverity: null,
      affectedContainerCount: 0,
      topIssue: null,
    },
    containers,
    alerts: [],
    alertIncidents: emptyAlertIncidents(),
  }
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    ...init,
  })
}

function buildCommand(data: ShipmentDetailVM | null | undefined) {
  return {
    data,
    setIsRefreshing: vi.fn(),
    setRefreshError: vi.fn(),
    setRefreshHint: vi.fn(),
    setRefreshRetry: vi.fn<(value: RefreshRetryState | null) => void>(),
    setLastRefreshDoneAt: vi.fn<(value: Instant | null) => void>(),
    setRealtimeCleanup: vi.fn<(cleanup: (() => void) | null) => void>(),
    refreshTrackingData: vi.fn(() => Promise.resolve()),
    isDisposed: vi.fn(() => false),
    toTimeoutMessage: (totalRetries: number) => `timeout:${totalRetries}`,
    toFailedMessage: (failedCount: number, firstError: string) =>
      `failed:${failedCount}:${firstError}`,
  }
}

function enqueueResponse(command: {
  readonly container: string
  readonly syncRequestId: string
}): Response {
  return jsonResponse({
    ok: true,
    container: command.container,
    syncRequestId: command.syncRequestId,
    queued: true,
    deduped: false,
  })
}

function statusResponse(command: {
  readonly allTerminal: boolean
  readonly requests: readonly {
    readonly syncRequestId: string
    readonly status: 'PENDING' | 'LEASED' | 'DONE' | 'FAILED' | 'NOT_FOUND'
    readonly lastError: string | null
    readonly updatedAt: string | null
    readonly refValue: string | null
  }[]
}): Response {
  return jsonResponse({
    ok: true,
    allTerminal: command.allTerminal,
    requests: command.requests,
  })
}

describe('refreshShipmentTracking', () => {
  beforeEach(() => {
    fetchWithHttpDegradationReportingMock.mockReset()
    pollRefreshSyncStatusMock.mockReset()
    realtimeUnsubscribeMock.mockReset()
    subscribeToSyncRequestsRealtimeByIdsMock.mockClear()
  })

  it('enqueues each container, waits for terminal sync status and reconciles before and after completion', async () => {
    fetchWithHttpDegradationReportingMock
      .mockResolvedValueOnce(
        enqueueResponse({
          container: 'MSCU1234567',
          syncRequestId: SYNC_REQUEST_ID_1,
        }),
      )
      .mockResolvedValueOnce(
        enqueueResponse({
          container: 'MSCU7654321',
          syncRequestId: SYNC_REQUEST_ID_2,
        }),
      )
      .mockResolvedValueOnce(
        statusResponse({
          allTerminal: true,
          requests: [
            {
              syncRequestId: SYNC_REQUEST_ID_1,
              status: 'DONE',
              lastError: null,
              updatedAt: '2026-04-10T10:00:00.000Z',
              refValue: 'MSCU1234567',
            },
            {
              syncRequestId: SYNC_REQUEST_ID_2,
              status: 'DONE',
              lastError: null,
              updatedAt: '2026-04-10T10:05:00.000Z',
              refValue: 'MSCU7654321',
            },
          ],
        }),
      )
    const command = buildCommand(
      buildShipment([
        buildContainer({
          id: 'container-1',
          number: 'MSCU1234567',
        }),
        buildContainer({
          id: 'container-2',
          number: 'MSCU7654321',
        }),
      ]),
    )

    await refreshShipmentTracking(command)

    expect(fetchWithHttpDegradationReportingMock).toHaveBeenNthCalledWith(
      1,
      '/api/refresh',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ container: 'MSCU1234567', carrier: 'MSC' }),
      }),
    )
    expect(fetchWithHttpDegradationReportingMock).toHaveBeenNthCalledWith(
      2,
      '/api/refresh',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ container: 'MSCU7654321', carrier: 'MSC' }),
      }),
    )
    expect(fetchWithHttpDegradationReportingMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining(`sync_request_id=${encodeURIComponent(SYNC_REQUEST_ID_1)}`),
      expect.objectContaining({
        cache: 'no-store',
      }),
    )
    expect(command.refreshTrackingData).toHaveBeenCalledTimes(2)
    expect(command.setRefreshError).toHaveBeenLastCalledWith(null)
    expect(command.setLastRefreshDoneAt).toHaveBeenCalledWith(
      Instant.fromIso('2026-04-10T10:05:00.000Z'),
    )
    expect(command.setIsRefreshing).toHaveBeenLastCalledWith(false)
    expect(command.setRefreshRetry).toHaveBeenLastCalledWith(null)
  })

  it('surfaces enqueue failures without inventing successful sync requests', async () => {
    fetchWithHttpDegradationReportingMock.mockResolvedValue(
      jsonResponse(
        {
          error: 'carrier down',
        },
        {
          status: 500,
          statusText: 'Internal Server Error',
        },
      ),
    )
    const command = buildCommand(
      buildShipment([
        buildContainer({
          id: 'container-1',
          number: 'MSCU1234567',
        }),
      ]),
    )

    await refreshShipmentTracking(command)

    expect(subscribeToSyncRequestsRealtimeByIdsMock).not.toHaveBeenCalled()
    expect(command.setRefreshError).toHaveBeenCalledWith('failed:1:carrier down')
    expect(command.refreshTrackingData).toHaveBeenCalledTimes(1)
    expect(command.setLastRefreshDoneAt).not.toHaveBeenCalled()
  })

  it('surfaces terminal failed statuses after a successful enqueue', async () => {
    fetchWithHttpDegradationReportingMock
      .mockResolvedValueOnce(
        enqueueResponse({
          container: 'MSCU1234567',
          syncRequestId: SYNC_REQUEST_ID_1,
        }),
      )
      .mockResolvedValueOnce(
        statusResponse({
          allTerminal: true,
          requests: [
            {
              syncRequestId: SYNC_REQUEST_ID_1,
              status: 'FAILED',
              lastError: 'provider rejected request',
              updatedAt: '2026-04-10T10:00:00.000Z',
              refValue: 'MSCU1234567',
            },
          ],
        }),
      )
    const command = buildCommand(
      buildShipment([
        buildContainer({
          id: 'container-1',
          number: 'MSCU1234567',
        }),
      ]),
    )

    await refreshShipmentTracking(command)

    expect(command.setRefreshError).toHaveBeenCalledWith('failed:1:provider rejected request')
    expect(command.setLastRefreshDoneAt).not.toHaveBeenCalled()
    expect(command.refreshTrackingData).toHaveBeenCalledTimes(2)
  })

  it('reports timeout when sync requests never reach a terminal status', async () => {
    fetchWithHttpDegradationReportingMock
      .mockResolvedValueOnce(
        enqueueResponse({
          container: 'MSCU1234567',
          syncRequestId: SYNC_REQUEST_ID_1,
        }),
      )
      .mockResolvedValueOnce(
        statusResponse({
          allTerminal: false,
          requests: [
            {
              syncRequestId: SYNC_REQUEST_ID_1,
              status: 'PENDING',
              lastError: null,
              updatedAt: '2026-04-10T10:00:00.000Z',
              refValue: 'MSCU1234567',
            },
          ],
        }),
      )
    pollRefreshSyncStatusMock.mockResolvedValue({
      kind: 'timeout',
      attempts: 5,
      lastResponse: null,
    })
    const command = buildCommand(
      buildShipment([
        buildContainer({
          id: 'container-1',
          number: 'MSCU1234567',
        }),
      ]),
    )

    await refreshShipmentTracking(command)

    expect(pollRefreshSyncStatusMock).toHaveBeenCalled()
    expect(command.setRefreshError).toHaveBeenCalledWith('timeout:5')
    expect(command.setLastRefreshDoneAt).not.toHaveBeenCalled()
  })

  it('does nothing when shipment or containers are absent', async () => {
    await refreshShipmentTracking(buildCommand(null))
    await refreshShipmentTracking(buildCommand(buildShipment([])))

    expect(fetchWithHttpDegradationReportingMock).not.toHaveBeenCalled()
  })
})
