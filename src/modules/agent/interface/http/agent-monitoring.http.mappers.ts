import type { z } from 'zod/v4'

import type { AgentMonitoringUseCases } from '~/modules/agent/application/agent-monitoring.usecases'
import type {
  AgentHeartbeatBodySchema,
  AgentListQuerySchema,
} from '~/modules/agent/interface/http/agent-monitoring.schemas'

type ListAgentsInput = z.infer<typeof AgentListQuerySchema>
type HeartbeatInput = z.infer<typeof AgentHeartbeatBodySchema>
type HeartbeatActivityCommand = {
  readonly agentId: string
  readonly tenantId: string
  readonly type:
    | 'ENROLLED'
    | 'HEARTBEAT'
    | 'LEASED_TARGET'
    | 'SNAPSHOT_INGESTED'
    | 'REQUEST_FAILED'
    | 'REALTIME_SUBSCRIBED'
    | 'REALTIME_CHANNEL_ERROR'
    | 'LEASE_CONFLICT'
    | 'UPDATE_CHECKED'
    | 'UPDATE_AVAILABLE'
    | 'UPDATE_DOWNLOAD_STARTED'
    | 'UPDATE_DOWNLOAD_COMPLETED'
    | 'UPDATE_READY'
    | 'UPDATE_APPLY_STARTED'
    | 'UPDATE_APPLY_FAILED'
    | 'RESTART_FOR_UPDATE'
    | 'ROLLBACK_EXECUTED'
  readonly message: string
  readonly severity: 'info' | 'warning' | 'danger' | 'success'
  readonly metadata?: unknown
  readonly occurredAt?: string
}

export function toListAgentsCommand(command: {
  readonly tenantId: string
  readonly query: ListAgentsInput
}): Parameters<AgentMonitoringUseCases['listAgents']>[0] {
  return {
    tenantId: command.tenantId,
    search: command.query.search,
    status: command.query.status,
    capability: command.query.capability,
    onlyProblematic: command.query.only_problematic,
    sortField: command.query.sort_field,
    sortDirection: command.query.sort_dir,
  }
}

export function toAgentDetailCommand(command: {
  readonly tenantId: string
  readonly agentId: string
}): Parameters<AgentMonitoringUseCases['getAgentDetail']>[0] {
  return {
    tenantId: command.tenantId,
    agentId: command.agentId,
  }
}

export function toHeartbeatCommand(command: {
  readonly authenticatedAgentId: string
  readonly tenantId: string
  readonly payload: HeartbeatInput
}): Parameters<AgentMonitoringUseCases['touchHeartbeat']>[0] {
  return {
    agentId: command.authenticatedAgentId,
    tenantId: command.tenantId,
    hostname: command.payload.hostname,
    version: command.payload.agent_version,
    currentVersion: command.payload.current_version ?? command.payload.agent_version,
    desiredVersion: command.payload.desired_version,
    updaterState: command.payload.update_state,
    updaterLastCheckedAt: command.payload.updater_last_checked_at,
    updaterLastError: command.payload.updater_last_error,
    updateReadyVersion: command.payload.update_ready_version,
    restartRequestedAt: command.payload.restart_requested_at,
    bootStatus: command.payload.boot_status,
    realtimeState: command.payload.realtime_state,
    processingState: command.payload.processing_state,
    leaseHealth: command.payload.lease_health,
    activeJobs: command.payload.active_jobs,
    capabilities: command.payload.capabilities,
    intervalSec: command.payload.interval_sec,
    queueLagSeconds: command.payload.queue_lag_seconds,
    lastError: command.payload.last_error,
    status: command.payload.status,
    occurredAt: command.payload.occurred_at,
  }
}

export function toHeartbeatActivityCommands(command: {
  readonly authenticatedAgentId: string
  readonly tenantId: string
  readonly payload: HeartbeatInput
}): readonly HeartbeatActivityCommand[] {
  return command.payload.activity.map((activity) => ({
    agentId: command.authenticatedAgentId,
    tenantId: command.tenantId,
    type: activity.type,
    message: activity.message,
    severity: activity.severity,
    metadata: activity.metadata,
    occurredAt: activity.occurred_at,
  }))
}
