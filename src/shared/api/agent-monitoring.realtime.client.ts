import {
  type AgentMonitoringRealtimeEvent,
  type AgentMonitoringRealtimeStatusUpdate,
  subscribeAgentLogsByAgentId,
  subscribeTrackingAgentActivityByAgentId,
  subscribeTrackingAgentsByTenant,
} from '~/shared/supabase/agent-monitoring.realtime'
import { supabase } from '~/shared/supabase/supabase'

export type { AgentMonitoringRealtimeEvent }
export type { AgentMonitoringRealtimeStatusUpdate }

export function subscribeToTrackingAgentsByTenant(command: {
  readonly tenantId: string
  readonly onEvent: (event: AgentMonitoringRealtimeEvent) => void
  readonly onStatus?: (status: AgentMonitoringRealtimeStatusUpdate) => void
}): { readonly unsubscribe: () => void } {
  return subscribeTrackingAgentsByTenant({
    client: supabase,
    tenantId: command.tenantId,
    onEvent: command.onEvent,
    onStatus: command.onStatus,
  })
}

export function subscribeToTrackingAgentActivityByAgentId(command: {
  readonly agentId: string
  readonly onEvent: (event: AgentMonitoringRealtimeEvent) => void
  readonly onStatus?: (status: AgentMonitoringRealtimeStatusUpdate) => void
}): { readonly unsubscribe: () => void } {
  return subscribeTrackingAgentActivityByAgentId({
    client: supabase,
    agentId: command.agentId,
    onEvent: command.onEvent,
    onStatus: command.onStatus,
  })
}

export function subscribeToAgentLogsByAgentId(command: {
  readonly agentId: string
  readonly onEvent: (event: AgentMonitoringRealtimeEvent) => void
  readonly onStatus?: (status: AgentMonitoringRealtimeStatusUpdate) => void
}): { readonly unsubscribe: () => void } {
  return subscribeAgentLogsByAgentId({
    client: supabase,
    agentId: command.agentId,
    onEvent: command.onEvent,
    onStatus: command.onStatus,
  })
}
