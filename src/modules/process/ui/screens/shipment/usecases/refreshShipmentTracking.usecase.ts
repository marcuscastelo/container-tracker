import {
  readErrorFromJsonBody,
  toReadableErrorMessage,
} from '~/modules/process/ui/screens/shipment/lib/shipmentError.presenter'
import {
  applyRefreshStatusRequests,
  mapRealtimeEventToRefreshStatus,
  RefreshPostResponseSchema,
  type RefreshStatusRequest,
  type RefreshStatusResponse,
  RefreshStatusResponseSchema,
  toLatestDoneAtOrNow,
  toRefreshStatusResponseFromMap,
} from '~/modules/process/ui/screens/shipment/lib/shipmentRefresh.status'
import type { RefreshRetryState } from '~/modules/process/ui/screens/shipment/types/shipmentScreen.types'
import {
  REFRESH_SYNC_INITIAL_DELAY_MS,
  REFRESH_SYNC_MAX_RETRIES,
} from '~/modules/process/ui/screens/shipment/types/shipmentScreen.types'
import { pollRefreshSyncStatus } from '~/modules/process/ui/utils/refresh-sync-polling'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { subscribeToSyncRequestsRealtimeByIds } from '~/shared/api/sync-requests.realtime.client'

// ── API helpers ──────────────────────────────────────────────────────────────

async function enqueueContainerRefresh(
  containerNumber: string,
  carrier: string | null | undefined,
): Promise<{ readonly syncRequestId: string }> {
  const response = await fetch('/api/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ container: containerNumber, carrier: carrier ?? null }),
  })

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const errorMessage = readErrorFromJsonBody(body) ?? response.statusText
    throw new Error(`refresh failed for ${containerNumber}: ${response.status} ${errorMessage}`)
  }

  const parsed = RefreshPostResponseSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(`refresh failed for ${containerNumber}: invalid enqueue response`)
  }

  return { syncRequestId: parsed.data.syncRequestId }
}

async function fetchRefreshSyncStatuses(syncRequestIds: readonly string[]) {
  const params = new URLSearchParams()
  for (const syncRequestId of syncRequestIds) {
    params.append('sync_request_id', syncRequestId)
  }
  params.set('_ts', String(Date.now()))

  const response = await fetch(`/api/refresh/status?${params.toString()}`, {
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  })
  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const errorMessage = readErrorFromJsonBody(body) ?? response.statusText
    throw new Error(`refresh status failed: ${response.status} ${errorMessage}`)
  }

  const parsed = RefreshStatusResponseSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error('refresh status failed: invalid response payload')
  }

  return parsed.data
}

// ── Wait for terminal sync requests ─────────────────────────────────────────

type WaitForTerminalSyncRequestsCommand = {
  readonly syncRequestIds: readonly string[]
  readonly setRefreshRetry: (value: RefreshRetryState | null) => void
  readonly setRealtimeCleanup: (cleanup: (() => void) | null) => void
  readonly isDisposed: () => boolean
}

type WaitForTerminalSyncRequestsResult =
  | { readonly kind: 'completed'; readonly response: RefreshStatusResponse }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'cancelled' }

async function waitForTerminalSyncRequests(
  command: WaitForTerminalSyncRequestsCommand,
): Promise<WaitForTerminalSyncRequestsResult> {
  const syncRequestIdSet = new Set(command.syncRequestIds)
  const statusBySyncRequestId = new Map<string, RefreshStatusRequest>()

  let isResolved = false
  let resolveRealtimeTerminal: ((response: RefreshStatusResponse) => void) | null = null
  const realtimeTerminalPromise = new Promise<RefreshStatusResponse>((resolve) => {
    resolveRealtimeTerminal = resolve
  })

  const resolveIfAllTerminal = () => {
    if (isResolved || resolveRealtimeTerminal === null) {
      return
    }

    const consolidatedResponse = toRefreshStatusResponseFromMap(
      command.syncRequestIds,
      statusBySyncRequestId,
    )

    if (!consolidatedResponse.allTerminal) {
      return
    }

    isResolved = true
    resolveRealtimeTerminal(consolidatedResponse)
  }

  const realtimeSubscription = subscribeToSyncRequestsRealtimeByIds({
    syncRequestIds: command.syncRequestIds,
    onEvent(event) {
      if (command.isDisposed() || isResolved) return

      const requestStatus = mapRealtimeEventToRefreshStatus(event, syncRequestIdSet)
      if (!requestStatus) return

      statusBySyncRequestId.set(requestStatus.syncRequestId, requestStatus)
      resolveIfAllTerminal()
    },
    onStatus(channelStatus) {
      if (channelStatus.state === 'CHANNEL_ERROR' || channelStatus.state === 'TIMED_OUT') {
        console.warn('[refresh] sync_requests realtime channel degraded', channelStatus)
      }
    },
  })

  command.setRealtimeCleanup(realtimeSubscription.unsubscribe)

  const bootstrapStatus = await fetchRefreshSyncStatuses(command.syncRequestIds)
  applyRefreshStatusRequests(statusBySyncRequestId, bootstrapStatus.requests)
  resolveIfAllTerminal()

  if (isResolved) {
    return {
      kind: 'completed',
      response: toRefreshStatusResponseFromMap(command.syncRequestIds, statusBySyncRequestId),
    }
  }

  const watchdogPromise = pollRefreshSyncStatus({
    syncRequestIds: command.syncRequestIds,
    maxRetries: REFRESH_SYNC_MAX_RETRIES,
    initialDelayMs: REFRESH_SYNC_INITIAL_DELAY_MS,
    fetchSyncStatus: async (syncRequestIds) => {
      const response = await fetchRefreshSyncStatuses(syncRequestIds)
      applyRefreshStatusRequests(statusBySyncRequestId, response.requests)
      resolveIfAllTerminal()
      return response
    },
    onRetryStart(progress) {
      if (!command.isDisposed()) {
        command.setRefreshRetry(progress)
      }
    },
    shouldStop: () => command.isDisposed() || isResolved,
  })
    .then((result) => ({ kind: 'watchdog' as const, result }))
    .catch((error: unknown) => ({ kind: 'watchdog_error' as const, error }))

  const resolution = await Promise.race([
    realtimeTerminalPromise.then((response) => ({ kind: 'realtime' as const, response })),
    watchdogPromise,
  ])

  if (resolution.kind === 'watchdog_error') {
    throw resolution.error
  }

  if (resolution.kind === 'realtime') {
    command.setRefreshRetry(null)
    return {
      kind: 'completed',
      response: resolution.response,
    }
  }

  if (resolution.result.kind === 'cancelled') {
    return { kind: 'cancelled' }
  }

  if (resolution.result.kind === 'timeout') {
    return { kind: 'timeout' }
  }

  return {
    kind: 'completed',
    response: resolution.result.response,
  }
}

// ── Main refresh usecase ─────────────────────────────────────────────────────

export type RefreshShipmentTrackingCommand = {
  readonly data: ShipmentDetailVM | null | undefined
  readonly setIsRefreshing: (value: boolean) => void
  readonly setRefreshError: (value: string | null) => void
  readonly setRefreshHint: (value: string | null) => void
  readonly setRefreshRetry: (value: RefreshRetryState | null) => void
  readonly setLastRefreshDoneAt: (value: Date | null) => void
  readonly setRealtimeCleanup: (cleanup: (() => void) | null) => void
  readonly refreshTrackingData: () => Promise<void> // i18n-enforce-ignore
  readonly isDisposed: () => boolean
  readonly toTimeoutMessage: (totalRetries: number) => string
  readonly toFailedMessage: (failedCount: number, firstError: string) => string
}

export async function refreshShipmentTracking(
  params: RefreshShipmentTrackingCommand,
): Promise<void> {
  const data = params.data
  if (!data) return

  const containers = data.containers
  if (containers.length === 0) return

  try {
    if (params.isDisposed()) return

    params.setRefreshError(null)
    params.setRefreshHint(null)
    params.setRefreshRetry(null)
    params.setIsRefreshing(true)

    const enqueueResults = await Promise.allSettled(
      containers.map((container) => enqueueContainerRefresh(container.number, data.carrier)),
    )

    const syncRequestIds: string[] = []
    const enqueueErrors: string[] = []

    for (const result of enqueueResults) {
      if (result.status === 'fulfilled') {
        syncRequestIds.push(result.value.syncRequestId)
      } else {
        enqueueErrors.push(toReadableErrorMessage(result.reason))
      }
    }

    const uniqueSyncRequestIds = Array.from(new Set(syncRequestIds))

    if (uniqueSyncRequestIds.length === 0) {
      const firstError = enqueueErrors[0] ?? 'Refresh failed'
      params.setRefreshError(params.toFailedMessage(enqueueErrors.length || 1, firstError))
      return
    }

    // Reflect queued sync requests immediately in chips/header (syncing state) before terminal wait.
    try {
      await params.refreshTrackingData()
    } catch (err) {
      console.error('Failed to refresh tracking data after enqueue:', err)
    }

    const waitResult = await waitForTerminalSyncRequests({
      syncRequestIds: uniqueSyncRequestIds,
      setRefreshRetry: params.setRefreshRetry,
      setRealtimeCleanup(cleanup) {
        params.setRealtimeCleanup(cleanup)
      },
      isDisposed: params.isDisposed,
    })

    if (waitResult.kind === 'cancelled') {
      return
    }

    if (waitResult.kind === 'timeout') {
      params.setRefreshError(params.toTimeoutMessage(REFRESH_SYNC_MAX_RETRIES))
      return
    }

    const finalStatusResponse = waitResult.response

    const failedStatuses = finalStatusResponse.requests.filter((requestStatus) => {
      return requestStatus.status === 'FAILED' || requestStatus.status === 'NOT_FOUND'
    })

    const statusErrors = failedStatuses.map((requestStatus) => {
      return requestStatus.lastError ?? `sync_request_${requestStatus.syncRequestId}_failed`
    })

    const allErrors = [...enqueueErrors, ...statusErrors]
    if (allErrors.length > 0) {
      params.setRefreshError(params.toFailedMessage(allErrors.length, allErrors[0]))
      return
    }

    params.setLastRefreshDoneAt(toLatestDoneAtOrNow(finalStatusResponse.requests))
    params.setRefreshError(null)
  } catch (err) {
    const readableMessage = toReadableErrorMessage(err)

    console.error('Failed to refresh containers:', {
      original: err,
      message: readableMessage,
    })
    if (!params.isDisposed()) {
      params.setRefreshError(readableMessage || 'Refresh failed')
    }
  } finally {
    params.setRealtimeCleanup(null)

    const disposed = params.isDisposed()

    if (!disposed) {
      params.setIsRefreshing(false)
      params.setRefreshRetry(null)
    }

    if (!disposed) {
      try {
        await params.refreshTrackingData()
      } catch (err) {
        console.error('Failed to refresh tracking data after sync:', err)
      }
    }
  }
}
