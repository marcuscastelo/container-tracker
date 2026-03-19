import {
  type AgentLogLinePayload,
  type AgentLogsChannel,
  fetchAgentLogs,
} from '~/modules/agent/ui/api/agent.api'
import {
  type AgentMonitoringRealtimeEvent,
  type AgentMonitoringRealtimeStatusUpdate,
  subscribeToAgentLogsByAgentId,
} from '~/shared/api/agent-monitoring.realtime.client'

export async function fetchAgentLogsBacklog(command: {
  readonly agentId: string
  readonly channel: AgentLogsChannel
  readonly tail: number
}): Promise<{
  readonly agentId: string
  readonly os: string
  readonly logsSupported: boolean
  readonly lastLogAt: string | null
  readonly lines: readonly AgentLogLinePayload[]
}> {
  return fetchAgentLogs({
    agentId: command.agentId,
    query: {
      channel: command.channel,
      tail: command.tail,
    },
  })
}

export function subscribeAgentLogs(command: {
  readonly agentId: string
  readonly onEvent: (event: AgentMonitoringRealtimeEvent) => void
  readonly onStatus?: (status: AgentMonitoringRealtimeStatusUpdate) => void
}): { readonly unsubscribe: () => void } {
  return subscribeToAgentLogsByAgentId({
    agentId: command.agentId,
    onEvent: command.onEvent,
    onStatus: command.onStatus,
  })
}
