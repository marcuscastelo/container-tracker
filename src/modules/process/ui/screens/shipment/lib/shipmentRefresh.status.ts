import { z } from 'zod/v4'
import type { SyncRequestRealtimeEvent } from '~/shared/api/sync-requests.realtime.client'

export const RefreshPostResponseSchema = z.object({
  ok: z.literal(true),
  container: z.string(),
  syncRequestId: z.string().uuid(),
  queued: z.literal(true),
  deduped: z.boolean(),
})

export const RefreshStatusResponseSchema = z.object({
  ok: z.literal(true),
  allTerminal: z.boolean(),
  requests: z.array(
    z.object({
      syncRequestId: z.string().uuid(),
      status: z.enum(['PENDING', 'LEASED', 'DONE', 'FAILED', 'NOT_FOUND']),
      lastError: z.string().nullable(),
      updatedAt: z.string().nullable(),
      refValue: z.string().nullable(),
    }),
  ),
})

export type RefreshStatusRequest = {
  readonly syncRequestId: string
  readonly status: 'PENDING' | 'LEASED' | 'DONE' | 'FAILED' | 'NOT_FOUND'
  readonly lastError: string | null
  readonly updatedAt: string | null
  readonly refValue: string | null
}

export type RefreshStatusResponse = {
  readonly ok: true
  readonly allTerminal: boolean
  readonly requests: readonly RefreshStatusRequest[]
}

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

export function toLatestDoneAtOrNow(requests: readonly RefreshStatusRequest[]): Date {
  const doneTimestamps = requests
    .map((request) => {
      if (request.status !== 'DONE' || request.updatedAt === null) {
        return Number.NaN
      }
      return Date.parse(request.updatedAt)
    })
    .filter((value) => Number.isFinite(value))

  if (doneTimestamps.length === 0) {
    return new Date()
  }

  return new Date(Math.max(...doneTimestamps))
}
