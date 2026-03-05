import { describe, expect, it, vi } from 'vitest'
import {
  type SyncRequestsRealtimeClient,
  subscribeSyncRequestsByContainerRefs,
  subscribeSyncRequestsByIds,
  subscribeSyncRequestsByTenant,
} from '~/shared/supabase/sync-requests.realtime'

type RealtimePayload = {
  readonly eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  readonly old?: unknown
  readonly new?: unknown
}

type FakeRealtimeChannelRecord = {
  readonly name: string
  filter: string | null
  onPayload: ((payload: RealtimePayload) => void) | null
  onStatus: ((status: string, error?: Error | null) => void) | null
}

function createFakeRealtimeClient(): {
  readonly client: SyncRequestsRealtimeClient
  readonly records: FakeRealtimeChannelRecord[]
  readonly removedNames: string[]
} {
  const records: FakeRealtimeChannelRecord[] = []
  const removedNames: string[] = []
  const recordsByChannel = new Map<object, FakeRealtimeChannelRecord>()

  const client: SyncRequestsRealtimeClient = {
    channel(name: string) {
      const record: FakeRealtimeChannelRecord = {
        name,
        filter: null,
        onPayload: null,
        onStatus: null,
      }
      records.push(record)

      const channel = {
        on(
          _type: 'postgres_changes',
          filter: {
            readonly event: '*'
            readonly schema: 'public'
            readonly table: 'sync_requests'
            readonly filter: string
          },
          callback: (payload: RealtimePayload) => void,
        ) {
          record.filter = filter.filter
          record.onPayload = callback
          return channel
        },
        subscribe(callback?: (status: string, error?: Error | null) => void) {
          record.onStatus = callback ?? null
          return channel
        },
      }
      recordsByChannel.set(channel, record)

      return channel
    },
    async removeChannel(channel) {
      const record = recordsByChannel.get(channel)
      if (record) {
        removedNames.push(record.name)
      }

      return 'ok'
    },
  }

  return { client, records, removedNames }
}

function createSyncRequestPayload(command: {
  readonly id: string
  readonly tenantId: string
  readonly status: 'PENDING' | 'LEASED' | 'DONE' | 'FAILED'
}): RealtimePayload {
  return {
    eventType: 'UPDATE',
    new: {
      id: command.id,
      tenant_id: command.tenantId,
      status: command.status,
      last_error: null,
      updated_at: '2026-02-25T20:00:00.000Z',
      ref_value: 'MRKU2733926',
      leased_by: null,
      leased_until: null,
    },
    old: null,
  }
}

describe('sync-requests realtime', () => {
  it('subscribes by ids with deduped filters', () => {
    const fake = createFakeRealtimeClient()
    const onEvent = vi.fn()

    subscribeSyncRequestsByIds({
      client: fake.client,
      syncRequestIds: [
        '8cbdb7e4-6f98-4740-a26c-c95f8ab9ca89',
        '8cbdb7e4-6f98-4740-a26c-c95f8ab9ca89',
        '5752efb8-da39-4007-95c8-e4046704a98a',
      ],
      onEvent,
    })

    expect(fake.records).toHaveLength(2)
    expect(fake.records.map((record) => record.filter)).toEqual([
      'id=eq.8cbdb7e4-6f98-4740-a26c-c95f8ab9ca89',
      'id=eq.5752efb8-da39-4007-95c8-e4046704a98a',
    ])
  })

  it('subscribes by container refs with normalization and dedupe', () => {
    const fake = createFakeRealtimeClient()

    subscribeSyncRequestsByContainerRefs({
      client: fake.client,
      containerNumbers: [' mrku2733926 ', 'MRKU2733926', 'tghu9472160'],
      onEvent: vi.fn(),
    })

    expect(fake.records).toHaveLength(2)
    expect(fake.records.map((record) => record.filter)).toEqual([
      'ref_type=eq.container&ref_value=eq.MRKU2733926',
      'ref_type=eq.container&ref_value=eq.TGHU9472160',
    ])
  })

  it('normalizes valid realtime payloads', () => {
    const fake = createFakeRealtimeClient()
    const onEvent = vi.fn()

    subscribeSyncRequestsByTenant({
      client: fake.client,
      tenantId: '1196930b-d856-4960-8bb1-cc44ea64afb8',
      onEvent,
    })

    fake.records[0]?.onPayload?.(
      createSyncRequestPayload({
        id: 'd3058d39-2ee8-4a0f-a3dd-22999d2f9f45',
        tenantId: '1196930b-d856-4960-8bb1-cc44ea64afb8',
        status: 'DONE',
      }),
    )

    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith({
      eventType: 'UPDATE',
      row: {
        id: 'd3058d39-2ee8-4a0f-a3dd-22999d2f9f45',
        tenant_id: '1196930b-d856-4960-8bb1-cc44ea64afb8',
        status: 'DONE',
        last_error: null,
        updated_at: '2026-02-25T20:00:00.000Z',
        ref_value: 'MRKU2733926',
        leased_by: null,
        leased_until: null,
      },
      oldRow: null,
    })
  })

  it('drops invalid realtime payloads and keeps channel alive', () => {
    const fake = createFakeRealtimeClient()
    const onEvent = vi.fn()

    subscribeSyncRequestsByTenant({
      client: fake.client,
      tenantId: '1196930b-d856-4960-8bb1-cc44ea64afb8',
      onEvent,
    })

    fake.records[0]?.onPayload?.({
      eventType: 'UPDATE',
      new: {
        id: 'not-a-uuid',
      },
    })

    fake.records[0]?.onPayload?.(
      createSyncRequestPayload({
        id: '5dcd6892-9de4-4958-ba8d-d5e349eea0a3',
        tenantId: '1196930b-d856-4960-8bb1-cc44ea64afb8',
        status: 'PENDING',
      }),
    )

    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent.mock.calls[0]?.[0]).toMatchObject({
      row: {
        id: '5dcd6892-9de4-4958-ba8d-d5e349eea0a3',
        status: 'PENDING',
      },
    })
  })

  it('propagates channel status and unsubscribes from all channels', async () => {
    const recordsByChannel = new Map<object, FakeRealtimeChannelRecord>()
    const removedNames: string[] = []

    const client: SyncRequestsRealtimeClient = {
      channel(name: string) {
        const record: FakeRealtimeChannelRecord = {
          name,
          filter: null,
          onPayload: null,
          onStatus: null,
        }
        const channel = {
          on(
            _type: 'postgres_changes',
            filter: {
              readonly event: '*'
              readonly schema: 'public'
              readonly table: 'sync_requests'
              readonly filter: string
            },
            callback: (payload: RealtimePayload) => void,
          ) {
            record.filter = filter.filter
            record.onPayload = callback
            return channel
          },
          subscribe(callback?: (status: string, error?: Error | null) => void) {
            record.onStatus = callback ?? null
            return channel
          },
        }
        recordsByChannel.set(channel, record)
        return channel
      },
      async removeChannel(channel) {
        const record = recordsByChannel.get(channel)
        if (record) {
          removedNames.push(record.name)
        }
        return 'ok'
      },
    }

    const onStatus = vi.fn()
    const subscription = subscribeSyncRequestsByIds({
      client,
      syncRequestIds: [
        '6f29ce9a-f744-4d91-99da-e79e6891a87a',
        '1f417012-2eb5-4bc3-babf-102411f0cb8f',
      ],
      onEvent: vi.fn(),
      onStatus,
    })

    const [firstRecord] = Array.from(recordsByChannel.values())
    firstRecord?.onStatus?.('SUBSCRIBED')
    firstRecord?.onStatus?.('CHANNEL_ERROR', new Error('socket failure'))

    expect(onStatus).toHaveBeenNthCalledWith(1, {
      state: 'SUBSCRIBED',
      scope: 'ids',
      key: 'id=eq.6f29ce9a-f744-4d91-99da-e79e6891a87a',
      errorMessage: null,
    })
    expect(onStatus).toHaveBeenNthCalledWith(2, {
      state: 'CHANNEL_ERROR',
      scope: 'ids',
      key: 'id=eq.6f29ce9a-f744-4d91-99da-e79e6891a87a',
      errorMessage: 'socket failure',
    })

    subscription.unsubscribe()
    await Promise.resolve()

    expect(removedNames).toHaveLength(2)
  })

  it('propagates status updates for container refs subscription', () => {
    const fake = createFakeRealtimeClient()
    const onStatus = vi.fn()

    subscribeSyncRequestsByContainerRefs({
      client: fake.client,
      containerNumbers: ['mrku2733926'],
      onEvent: vi.fn(),
      onStatus,
    })

    fake.records[0]?.onStatus?.('TIMED_OUT', new Error('channel timeout'))

    expect(onStatus).toHaveBeenCalledWith({
      state: 'TIMED_OUT',
      scope: 'container_refs',
      key: 'ref_type=eq.container&ref_value=eq.MRKU2733926',
      errorMessage: 'channel timeout',
    })
  })
})
