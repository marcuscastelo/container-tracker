import { z } from 'zod/v4'

const RealtimeEventTypeSchema = z.enum(['INSERT', 'UPDATE', 'DELETE'])
const RealtimeChannelStateSchema = z.enum(['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])

const TrackingAgentRealtimeRowSchema = z
  .object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    updated_at: z.string().nullable().optional().default(null),
  })
  .passthrough()

const TrackingAgentActivityRealtimeRowSchema = z
  .object({
    id: z.string().uuid(),
    agent_id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    occurred_at: z.string().nullable().optional().default(null),
  })
  .passthrough()

const RealtimePayloadSchema = z.object({
  eventType: RealtimeEventTypeSchema,
  old: z.unknown().optional(),
  new: z.unknown().optional(),
})

type PostgresChangesFilter = {
  readonly event: '*'
  readonly schema: 'public'
  readonly table: 'tracking_agents' | 'tracking_agent_activity_events'
  readonly filter: string
}

type AgentMonitoringRealtimeChannelLike<TChannel> = {
  on: (
    type: 'postgres_changes',
    filter: PostgresChangesFilter,
    callback: (payload: unknown) => void,
  ) => TChannel
  subscribe: (callback?: (status: string, err?: Error | null | undefined) => void) => TChannel
}

type DefaultAgentMonitoringRealtimeChannel = {
  on: (
    type: 'postgres_changes',
    filter: PostgresChangesFilter,
    callback: (payload: unknown) => void,
  ) => DefaultAgentMonitoringRealtimeChannel
  subscribe: (
    callback?: (status: string, err?: Error | null | undefined) => void,
  ) => DefaultAgentMonitoringRealtimeChannel
}

export type AgentMonitoringRealtimeClient<
  TChannel extends
    AgentMonitoringRealtimeChannelLike<TChannel> = DefaultAgentMonitoringRealtimeChannel,
> = {
  channel: (name: string) => TChannel
  removeChannel: (channel: TChannel) => Promise<unknown>
}

type SubscriptionScope = 'tenant_agents' | 'agent_activity'

export type AgentMonitoringRealtimeStatusUpdate = {
  readonly state: z.infer<typeof RealtimeChannelStateSchema>
  readonly scope: SubscriptionScope
  readonly key: string
  readonly errorMessage: string | null
}

export type AgentMonitoringRealtimeEvent = {
  readonly table: 'tracking_agents' | 'tracking_agent_activity_events'
  readonly eventType: z.infer<typeof RealtimeEventTypeSchema>
  readonly row: unknown | null
  readonly oldRow: unknown | null
}

function toChannelName(scope: SubscriptionScope, key: string): string {
  const randomSuffix =
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return `agent_monitoring:${scope}:${key}:${randomSuffix}`
}

function emitChannelStatus(command: {
  readonly rawStatus: string
  readonly error: Error | null | undefined
  readonly scope: SubscriptionScope
  readonly key: string
  readonly onStatus: ((status: AgentMonitoringRealtimeStatusUpdate) => void) | undefined
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

function normalizeRealtimeEvent(command: {
  readonly table: 'tracking_agents' | 'tracking_agent_activity_events'
  readonly payload: unknown
}): AgentMonitoringRealtimeEvent | null {
  const payloadResult = RealtimePayloadSchema.safeParse(command.payload)
  if (!payloadResult.success) return null
  const payload = payloadResult.data

  const parser =
    command.table === 'tracking_agents'
      ? TrackingAgentRealtimeRowSchema
      : TrackingAgentActivityRealtimeRowSchema

  const rowResult = parser.safeParse(payload.new)
  const oldRowResult = parser.safeParse(payload.old)
  const row = rowResult.success ? rowResult.data : null
  const oldRow = oldRowResult.success ? oldRowResult.data : null

  return {
    table: command.table,
    eventType: payload.eventType,
    row,
    oldRow,
  }
}

function subscribeToTableFilters<
  TChannel extends AgentMonitoringRealtimeChannelLike<TChannel>,
>(command: {
  readonly client: AgentMonitoringRealtimeClient<TChannel>
  readonly table: 'tracking_agents' | 'tracking_agent_activity_events'
  readonly scope: SubscriptionScope
  readonly filters: readonly string[]
  readonly onEvent: (event: AgentMonitoringRealtimeEvent) => void
  readonly onStatus?: (status: AgentMonitoringRealtimeStatusUpdate) => void
}): { readonly unsubscribe: () => void } {
  const channels = command.filters.map((filterValue) => {
    const channel = command.client.channel(toChannelName(command.scope, filterValue))
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: command.table,
          filter: filterValue,
        },
        (payload) => {
          const normalized = normalizeRealtimeEvent({
            table: command.table,
            payload,
          })
          if (!normalized) return
          command.onEvent(normalized)
        },
      )
      .subscribe((status, error) => {
        emitChannelStatus({
          rawStatus: status,
          error,
          scope: command.scope,
          key: filterValue,
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

export function subscribeTrackingAgentsByTenant<
  TChannel extends AgentMonitoringRealtimeChannelLike<TChannel>,
>(command: {
  readonly client: AgentMonitoringRealtimeClient<TChannel>
  readonly tenantId: string
  readonly onEvent: (event: AgentMonitoringRealtimeEvent) => void
  readonly onStatus?: (status: AgentMonitoringRealtimeStatusUpdate) => void
}): { readonly unsubscribe: () => void } {
  const tenantId = z.string().uuid().parse(command.tenantId)
  return subscribeToTableFilters({
    client: command.client,
    table: 'tracking_agents',
    scope: 'tenant_agents',
    filters: [`tenant_id=eq.${tenantId}`],
    onEvent: command.onEvent,
    onStatus: command.onStatus,
  })
}

export function subscribeTrackingAgentActivityByAgentId<
  TChannel extends AgentMonitoringRealtimeChannelLike<TChannel>,
>(command: {
  readonly client: AgentMonitoringRealtimeClient<TChannel>
  readonly agentId: string
  readonly onEvent: (event: AgentMonitoringRealtimeEvent) => void
  readonly onStatus?: (status: AgentMonitoringRealtimeStatusUpdate) => void
}): { readonly unsubscribe: () => void } {
  const agentId = z.string().uuid().parse(command.agentId)

  return subscribeToTableFilters({
    client: command.client,
    table: 'tracking_agent_activity_events',
    scope: 'agent_activity',
    filters: [`agent_id=eq.${agentId}`],
    onEvent: command.onEvent,
    onStatus: command.onStatus,
  })
}
