import { z } from 'zod/v4'

const SyncRequestStatusSchema = z.enum(['PENDING', 'LEASED', 'DONE', 'FAILED'])

const SyncRequestRealtimeRowSchema = z
  .object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    status: SyncRequestStatusSchema,
    last_error: z.string().nullable().optional().default(null),
    updated_at: z.string().nullable().optional().default(null),
    ref_value: z.string().nullable().optional().default(null),
    leased_by: z.string().nullable().optional().default(null),
    leased_until: z.string().nullable().optional().default(null),
  })
  .passthrough()

const RealtimeEventTypeSchema = z.enum(['INSERT', 'UPDATE', 'DELETE'])

const RealtimePayloadSchema = z.object({
  eventType: RealtimeEventTypeSchema,
  old: z.unknown().optional(),
  new: z.unknown().optional(),
})

const RealtimeChannelStateSchema = z.enum(['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])

const SyncRequestIdListSchema = z.array(z.string().uuid()).min(1)

const SyncRequestTenantIdSchema = z.string().uuid()

export type SyncRequestRealtimeStatus = z.infer<typeof SyncRequestStatusSchema>

export type SyncRequestRealtimeRow = z.infer<typeof SyncRequestRealtimeRowSchema>

export type SyncRequestRealtimeEventType = z.infer<typeof RealtimeEventTypeSchema>

export type SyncRequestsRealtimeChannelState = z.infer<typeof RealtimeChannelStateSchema>

export type SyncRequestRealtimeEvent = {
  readonly eventType: SyncRequestRealtimeEventType
  readonly row: SyncRequestRealtimeRow | null
  readonly oldRow: SyncRequestRealtimeRow | null
}

type PostgresChangesFilter = {
  readonly event: '*'
  readonly schema: 'public'
  readonly table: 'sync_requests'
  readonly filter: string
}

type PostgresChangesPayload = {
  readonly eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  readonly old?: unknown
  readonly new?: unknown
}

type SyncRequestsRealtimeChannelLike<TChannel> = {
  on: (
    type: 'postgres_changes',
    filter: PostgresChangesFilter,
    callback: (payload: PostgresChangesPayload) => void,
  ) => TChannel
  subscribe: (callback?: (status: string, err?: Error | null | undefined) => void) => TChannel
}

type DefaultSyncRequestsRealtimeChannel = {
  on: (
    type: 'postgres_changes',
    filter: PostgresChangesFilter,
    callback: (payload: PostgresChangesPayload) => void,
  ) => DefaultSyncRequestsRealtimeChannel
  subscribe: (
    callback?: (status: string, err?: Error | null | undefined) => void,
  ) => DefaultSyncRequestsRealtimeChannel
}

export type SyncRequestsRealtimeClient<
  TChannel extends SyncRequestsRealtimeChannelLike<TChannel> = DefaultSyncRequestsRealtimeChannel,
> = {
  channel: (name: string) => TChannel
  removeChannel: (channel: TChannel) => Promise<unknown>
}

type SubscriptionScope = 'ids' | 'tenant'

export type SyncRequestsRealtimeStatusUpdate = {
  readonly state: SyncRequestsRealtimeChannelState
  readonly scope: SubscriptionScope
  readonly key: string
  readonly errorMessage: string | null
}

function toChannelName(scope: SubscriptionScope, key: string): string {
  const randomSuffix =
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return `sync_requests:${scope}:${key}:${randomSuffix}`
}

function parseSyncRequestRow(value: unknown): SyncRequestRealtimeRow | null {
  const parsed = SyncRequestRealtimeRowSchema.safeParse(value)
  if (!parsed.success) {
    return null
  }
  return parsed.data
}

function normalizeRealtimeEvent(payload: unknown): SyncRequestRealtimeEvent | null {
  const parsedPayload = RealtimePayloadSchema.safeParse(payload)
  if (!parsedPayload.success) {
    return null
  }

  const row = parseSyncRequestRow(parsedPayload.data.new)
  const oldRow = parseSyncRequestRow(parsedPayload.data.old)

  if (!row && !oldRow) {
    return null
  }

  return {
    eventType: parsedPayload.data.eventType,
    row,
    oldRow,
  }
}

function emitChannelStatus(command: {
  readonly rawStatus: string
  readonly error: Error | null | undefined
  readonly scope: SubscriptionScope
  readonly key: string
  readonly onStatus: ((status: SyncRequestsRealtimeStatusUpdate) => void) | undefined
}): void {
  if (!command.onStatus) return

  const parsedStatus = RealtimeChannelStateSchema.safeParse(command.rawStatus)
  if (!parsedStatus.success) return

  command.onStatus({
    state: parsedStatus.data,
    scope: command.scope,
    key: command.key,
    errorMessage: command.error?.message ?? null,
  })
}

function subscribeToSyncRequestsFilters<
  TChannel extends SyncRequestsRealtimeChannelLike<TChannel>,
>(command: {
  readonly client: SyncRequestsRealtimeClient<TChannel>
  readonly filters: readonly { readonly scope: SubscriptionScope; readonly key: string }[]
  readonly onEvent: (event: SyncRequestRealtimeEvent) => void
  readonly onStatus?: (status: SyncRequestsRealtimeStatusUpdate) => void
}): { readonly unsubscribe: () => void } {
  const channels = command.filters.map((filterItem) => {
    const channel = command.client.channel(toChannelName(filterItem.scope, filterItem.key))
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_requests',
          filter: filterItem.key,
        },
        (payload) => {
          const event = normalizeRealtimeEvent(payload)
          if (!event) return
          command.onEvent(event)
        },
      )
      .subscribe((status, error) => {
        emitChannelStatus({
          rawStatus: status,
          error,
          scope: filterItem.scope,
          key: filterItem.key,
          onStatus: command.onStatus,
        })
      })

    return channel
  })

  let unsubscribed = false

  return {
    unsubscribe() {
      if (unsubscribed) return
      unsubscribed = true

      for (const channel of channels) {
        void command.client.removeChannel(channel)
      }
    },
  }
}

export function subscribeSyncRequestsByIds<
  TChannel extends SyncRequestsRealtimeChannelLike<TChannel>,
>(command: {
  readonly client: SyncRequestsRealtimeClient<TChannel>
  readonly syncRequestIds: readonly string[]
  readonly onEvent: (event: SyncRequestRealtimeEvent) => void
  readonly onStatus?: (status: SyncRequestsRealtimeStatusUpdate) => void
}): { readonly unsubscribe: () => void } {
  const parsedSyncRequestIds = SyncRequestIdListSchema.parse(command.syncRequestIds)
  const uniqueSyncRequestIds = Array.from(new Set(parsedSyncRequestIds))

  return subscribeToSyncRequestsFilters({
    client: command.client,
    filters: uniqueSyncRequestIds.map((syncRequestId) => ({
      scope: 'ids' as const,
      key: `id=eq.${syncRequestId}`,
    })),
    onEvent: command.onEvent,
    onStatus: command.onStatus,
  })
}

export function subscribeSyncRequestsByTenant<
  TChannel extends SyncRequestsRealtimeChannelLike<TChannel>,
>(command: {
  readonly client: SyncRequestsRealtimeClient<TChannel>
  readonly tenantId: string
  readonly onEvent: (event: SyncRequestRealtimeEvent) => void
  readonly onStatus?: (status: SyncRequestsRealtimeStatusUpdate) => void
}): { readonly unsubscribe: () => void } {
  const tenantId = SyncRequestTenantIdSchema.parse(command.tenantId)

  return subscribeToSyncRequestsFilters({
    client: command.client,
    filters: [
      {
        scope: 'tenant',
        key: `tenant_id=eq.${tenantId}`,
      },
    ],
    onEvent: command.onEvent,
    onStatus: command.onStatus,
  })
}
