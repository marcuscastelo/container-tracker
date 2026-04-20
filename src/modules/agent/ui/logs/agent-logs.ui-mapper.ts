import type { AgentLogLinePayload } from '~/modules/agent/ui/api/agent.api'
import type { AgentLogLineVM } from '~/modules/agent/ui/logs/agent-logs.vm'

function formatTime(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }

  return parsed.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function toAgentLogLineVM(payload: AgentLogLinePayload): AgentLogLineVM {
  return {
    id: payload.id,
    agentId: payload.agentId,
    sequence: payload.sequence,
    channel: payload.channel,
    channelLabel: payload.channel === 'stderr' ? 'ERR' : 'OUT',
    timestampIso: payload.timestamp,
    timestampDisplay: formatTime(payload.timestamp),
    message: payload.message,
    truncated: payload.truncated,
  }
}
