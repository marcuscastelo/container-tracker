import { describe, expect, it } from 'vitest'
import {
  shouldEnableAutoSyncFallbackPolling,
  toTrackedContainerNumberFromRealtimeEvent,
} from '~/modules/process/ui/utils/sync-realtime-coordinator'
import type { SyncRequestRealtimeEvent } from '~/shared/api/sync-requests.realtime.client'

function makeRealtimeEvent(
  overrides: Partial<SyncRequestRealtimeEvent> = {},
): SyncRequestRealtimeEvent {
  return {
    eventType: 'UPDATE',
    row: {
      id: 'd3058d39-2ee8-4a0f-a3dd-22999d2f9f45',
      tenant_id: '1196930b-d856-4960-8bb1-cc44ea64afb8',
      status: 'DONE',
      last_error: null,
      updated_at: '2026-03-05T12:00:00.000Z',
      ref_value: 'mrku2733926',
      leased_by: null,
      leased_until: null,
    },
    oldRow: null,
    ...overrides,
  }
}

describe('ShipmentView sync realtime helpers', () => {
  it('maps realtime event row ref_value to normalized tracked container number', () => {
    const containerNumber = toTrackedContainerNumberFromRealtimeEvent(
      makeRealtimeEvent({
        row: {
          id: 'd3058d39-2ee8-4a0f-a3dd-22999d2f9f45',
          tenant_id: '1196930b-d856-4960-8bb1-cc44ea64afb8',
          status: 'DONE',
          last_error: null,
          updated_at: '2026-03-05T12:00:00.000Z',
          ref_value: ' mrku2733926 ',
          leased_by: null,
          leased_until: null,
        },
      }),
    )

    expect(containerNumber).toBe('MRKU2733926')
  })

  it('maps realtime event oldRow ref_value on delete events', () => {
    const containerNumber = toTrackedContainerNumberFromRealtimeEvent(
      makeRealtimeEvent({
        eventType: 'DELETE',
        row: null,
        oldRow: {
          id: 'd3058d39-2ee8-4a0f-a3dd-22999d2f9f45',
          tenant_id: '1196930b-d856-4960-8bb1-cc44ea64afb8',
          status: 'FAILED',
          last_error: 'boom',
          updated_at: '2026-03-05T12:00:00.000Z',
          ref_value: 'mscu1234567',
          leased_by: null,
          leased_until: null,
        },
      }),
    )

    expect(containerNumber).toBe('MSCU1234567')
  })

  it('returns null when realtime event has no ref_value', () => {
    const containerNumber = toTrackedContainerNumberFromRealtimeEvent(
      makeRealtimeEvent({
        row: {
          id: 'd3058d39-2ee8-4a0f-a3dd-22999d2f9f45',
          tenant_id: '1196930b-d856-4960-8bb1-cc44ea64afb8',
          status: 'DONE',
          last_error: null,
          updated_at: '2026-03-05T12:00:00.000Z',
          ref_value: null,
          leased_by: null,
          leased_until: null,
        },
      }),
    )

    expect(containerNumber).toBeNull()
  })

  it('enables fallback polling when realtime is degraded and page is visible', () => {
    expect(
      shouldEnableAutoSyncFallbackPolling({
        hasSyncingContainers: false,
        isRealtimeDegraded: true,
        isPageVisible: true,
      }),
    ).toBe(true)
  })

  it('enables fallback polling when there are syncing containers and page is visible', () => {
    expect(
      shouldEnableAutoSyncFallbackPolling({
        hasSyncingContainers: true,
        isRealtimeDegraded: false,
        isPageVisible: true,
      }),
    ).toBe(true)
  })

  it('disables fallback polling when page is hidden', () => {
    expect(
      shouldEnableAutoSyncFallbackPolling({
        hasSyncingContainers: true,
        isRealtimeDegraded: true,
        isPageVisible: false,
      }),
    ).toBe(false)
  })
})
