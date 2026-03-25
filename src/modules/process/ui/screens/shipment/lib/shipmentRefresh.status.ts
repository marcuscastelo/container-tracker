import {
  RefreshPostResponseSchema,
  type RefreshStatusRequest,
  type RefreshStatusResponse,
  RefreshStatusResponseSchema,
} from '~/modules/process/ui/validation/shipmentRefresh.validation'
import type { SyncRequestRealtimeEvent } from '~/shared/api/sync-requests.realtime.client'
import { systemClock } from '~/shared/time/clock'
import { Instant } from '~/shared/time/instant'
import { parseInstantFromIso } from '~/shared/time/parsing'

export { RefreshPostResponseSchema, RefreshStatusResponseSchema }
export type { RefreshStatusRequest, RefreshStatusResponse }

export function mapRealtimeEventToRefreshStatus(
  event: SyncRequestRealtimeEvent,
  syncRequestIdSet: ReadonlySet<string>,
): RefreshStatusRequest | null {
  const row = event.row ?? event.oldRow
  if (!row) return null
  if (!syncRequestIdSet.has(row.id)) return null

  if (event.eventType === 'DELETE') {
    return {
      syncRequestId: row.id,
      status: 'NOT_FOUND',
      lastError: 'sync_request_not_found',
      updatedAt: row.updated_at,
      refValue: row.ref_value,
    }
  }

  return {
    syncRequestId: row.id,
    status: row.status,
    lastError: row.last_error,
    updatedAt: row.updated_at,
    refValue: row.ref_value,
  }
}

export function applyRefreshStatusRequests(
  statusBySyncRequestId: Map<string, RefreshStatusRequest>,
  requests: readonly RefreshStatusRequest[],
): void {
  for (const request of requests) {
    statusBySyncRequestId.set(request.syncRequestId, request)
  }
}

export function toRefreshStatusResponseFromMap(
  syncRequestIds: readonly string[],
  statusBySyncRequestId: ReadonlyMap<string, RefreshStatusRequest>,
): RefreshStatusResponse {
  const requests = syncRequestIds.map((syncRequestId) => {
    const known = statusBySyncRequestId.get(syncRequestId)
    if (known) return known

    return {
      syncRequestId,
      status: 'NOT_FOUND' as const,
      lastError: 'sync_request_not_found',
      updatedAt: null,
      refValue: null,
    }
  })

  const allTerminal = requests.every((request) => {
    return (
      request.status === 'DONE' || request.status === 'FAILED' || request.status === 'NOT_FOUND'
    )
  })

  return {
    ok: true,
    allTerminal,
    requests,
  }
}

export function toLatestDoneAtOrNow(requests: readonly RefreshStatusRequest[]): Instant {
  const doneTimestamps = requests
    .map((request) => {
      if (request.status !== 'DONE' || request.updatedAt === null) {
        return Number.NaN
      }
      return parseInstantFromIso(request.updatedAt)?.toEpochMs() ?? Number.NaN
    })
    .filter((value) => Number.isFinite(value))

  if (doneTimestamps.length === 0) {
    return systemClock.now()
  }

  return Instant.fromEpochMs(Math.max(...doneTimestamps))
}
