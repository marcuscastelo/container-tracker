import { createEffect, createMemo, createResource, createSignal, onCleanup } from 'solid-js'

import type { AgentLogLinePayload } from '~/modules/agent/ui/api/agent.api'
import { toAgentLogLineVM } from '~/modules/agent/ui/logs/agent-logs.ui-mapper'
import {
  fetchAgentLogsBacklog,
  subscribeAgentLogs,
} from '~/modules/agent/ui/logs/agent-logs.usecases'
import type {
  AgentLogLineVM,
  AgentLogsChannel,
  AgentLogsConnectionState,
} from '~/modules/agent/ui/logs/agent-logs.vm'

const DEFAULT_TAIL_LINES = 500
const MAX_VIEWPORT_LINES = 2000

function parseRealtimeLogPayload(event: {
  readonly table: string
  readonly eventType: string
  readonly row: unknown | null
}): AgentLogLinePayload | null {
  if (event.table !== 'agent_log_events' || event.eventType !== 'INSERT') {
    return null
  }

  const row = event.row
  if (typeof row !== 'object' || row === null) {
    return null
  }

  const id = Reflect.get(row, 'id')
  const agentId = Reflect.get(row, 'agent_id')
  const channel = Reflect.get(row, 'channel')
  const message = Reflect.get(row, 'message')
  const sequence = Reflect.get(row, 'sequence')
  const occurredAt = Reflect.get(row, 'occurred_at')
  const truncated = Reflect.get(row, 'truncated')

  if (typeof id !== 'string' || typeof agentId !== 'string') return null
  if (channel !== 'stdout' && channel !== 'stderr') return null
  if (typeof message !== 'string') return null
  if (typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < 0) return null

  return {
    id,
    agentId,
    channel,
    message,
    sequence,
    truncated: typeof truncated === 'boolean' ? truncated : false,
    timestamp:
      typeof occurredAt === 'string' && occurredAt.length > 0
        ? occurredAt
        : new Date().toISOString(),
  }
}

function keepNewestViewport(lines: readonly AgentLogLineVM[]): readonly AgentLogLineVM[] {
  if (lines.length <= MAX_VIEWPORT_LINES) return lines
  return lines.slice(lines.length - MAX_VIEWPORT_LINES)
}

function hasSequence(lines: readonly AgentLogLineVM[], sequence: number): boolean {
  return lines.some((line) => line.sequence === sequence)
}

export function useAgentLogsController(command: {
  readonly agentId: string
  readonly enabled?: () => boolean
}) {
  const enabled = command.enabled ?? (() => true)
  const [channel, setChannel] = createSignal<AgentLogsChannel>('both')
  const [connectionState, setConnectionState] = createSignal<AgentLogsConnectionState>('connecting')
  const [lines, setLines] = createSignal<readonly AgentLogLineVM[]>([])
  const [os, setOs] = createSignal<string | null>(null)
  const [logsSupported, setLogsSupported] = createSignal(false)
  const [lastLogAt, setLastLogAt] = createSignal<string | null>(null)
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = createSignal(true)
  const [hasBufferedLines, setHasBufferedLines] = createSignal(false)
  const [reconnectToken, setReconnectToken] = createSignal(0)

  const backlogKey = createMemo(() => ({
    enabled: enabled(),
    agentId: command.agentId,
    channel: channel(),
    reconnectToken: reconnectToken(),
  }))

  const [backlog, backlogActions] = createResource(
    () => {
      const key = backlogKey()
      if (!key.enabled) return undefined
      return {
        agentId: key.agentId,
        channel: key.channel,
        reconnectToken: key.reconnectToken,
      }
    },
    (key) =>
      fetchAgentLogsBacklog({
        agentId: key.agentId,
        channel: key.channel,
        tail: DEFAULT_TAIL_LINES,
      }),
  )

  createEffect(() => {
    const data = backlog()
    if (!data) return

    setOs(data.os)
    setLogsSupported(data.logsSupported)
    setLastLogAt(data.lastLogAt)
    setLines(keepNewestViewport(data.lines.map(toAgentLogLineVM)))

    if (isAutoScrollEnabled()) {
      setHasBufferedLines(false)
    }
  })

  createEffect(() => {
    if (!enabled()) {
      setConnectionState('disconnected')
      return
    }

    const agentId = command.agentId
    const currentReconnectToken = reconnectToken()

    setConnectionState(currentReconnectToken > 0 ? 'reconnecting' : 'connecting')

    const subscription = subscribeAgentLogs({
      agentId,
      onEvent(event) {
        const payload = parseRealtimeLogPayload(event)
        if (!payload) return
        if (payload.agentId !== agentId) return

        const currentChannel = channel()
        if (currentChannel !== 'both' && payload.channel !== currentChannel) {
          return
        }

        const vm = toAgentLogLineVM(payload)

        setLines((current) => {
          if (hasSequence(current, vm.sequence)) {
            return current
          }

          const next = [...current, vm].sort((left, right) => left.sequence - right.sequence)
          return keepNewestViewport(next)
        })

        setLastLogAt(payload.timestamp)

        if (!isAutoScrollEnabled()) {
          setHasBufferedLines(true)
        }
      },
      onStatus(status) {
        if (status.state === 'SUBSCRIBED') {
          setConnectionState('live')
          return
        }

        if (status.state === 'CHANNEL_ERROR' || status.state === 'TIMED_OUT') {
          setConnectionState('disconnected')
          return
        }

        if (status.state === 'CLOSED') {
          setConnectionState('disconnected')
        }
      },
    })

    onCleanup(() => subscription.unsubscribe())
  })

  function reconnect(): void {
    if (!enabled()) return
    setConnectionState('reconnecting')
    setReconnectToken((current) => current + 1)
    void backlogActions.refetch()
  }

  function clearViewport(): void {
    setLines([])
    setHasBufferedLines(false)
  }

  function jumpToLatest(): void {
    setIsAutoScrollEnabled(true)
    setHasBufferedLines(false)
  }

  return {
    channel,
    setChannel,
    connectionState,
    lines,
    os,
    logsSupported,
    lastLogAt,
    isAutoScrollEnabled,
    setIsAutoScrollEnabled,
    hasBufferedLines,
    reconnect,
    clearViewport,
    jumpToLatest,
    isLoading: () => backlog.loading,
    errorMessage: () => {
      const error = backlog.error
      if (!error) return null
      return error instanceof Error ? error.message : String(error)
    },
  }
}
