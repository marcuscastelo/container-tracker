import type { z } from 'zod/v4'

import type { AgentMonitoringUseCases } from '~/modules/agent/application/agent-monitoring.usecases'
import type {
  AgentHeartbeatBodySchema,
  AgentListQuerySchema,
  AgentLogIngestBodySchema,
  AgentLogsQuerySchema,
} from '~/modules/agent/interface/http/agent-monitoring.schemas'

type ListAgentsInput = z.infer<typeof AgentListQuerySchema>
type HeartbeatInput = z.infer<typeof AgentHeartbeatBodySchema>
type AgentLogsQueryInput = z.infer<typeof AgentLogsQuerySchema>
type AgentLogIngestBodyInput = z.infer<typeof AgentLogIngestBodySchema>
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
    | 'LOCAL_UPDATE_PAUSED'
    | 'LOCAL_UPDATE_RESUMED'
    | 'CHANNEL_CHANGED'
    | 'CONFIG_UPDATED'
    | 'RELEASE_ACTIVATED'
    | 'LOCAL_RESET'
    | 'REMOTE_RESET'
    | 'REMOTE_FORCE_UPDATE'
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
    onlyProblematic: command.query.only_problematic,
    sortField: command.query.sort_field,
    sortDirection: command.query.sort_dir,
    ...(command.query.search === undefined ? {} : { search: command.query.search }),
    ...(command.query.status === undefined ? {} : { status: command.query.status }),
    ...(command.query.capability === undefined ? {} : { capability: command.query.capability }),
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
  const currentVersion = command.payload.current_version ?? command.payload.agent_version

  return {
    agentId: command.authenticatedAgentId,
    tenantId: command.tenantId,
    ...(command.payload.hostname === undefined ? {} : { hostname: command.payload.hostname }),
    ...(command.payload.agent_version === undefined
      ? {}
      : { version: command.payload.agent_version }),
    ...(currentVersion === undefined ? {} : { currentVersion }),
    ...(command.payload.desired_version === undefined
      ? {}
      : { desiredVersion: command.payload.desired_version }),
    ...(command.payload.update_channel === undefined
      ? {}
      : { updateChannel: command.payload.update_channel }),
    ...(command.payload.update_state === undefined
      ? {}
      : { updaterState: command.payload.update_state }),
    ...(command.payload.updater_last_checked_at === undefined
      ? {}
      : { updaterLastCheckedAt: command.payload.updater_last_checked_at }),
    ...(command.payload.updater_last_error === undefined
      ? {}
      : { updaterLastError: command.payload.updater_last_error }),
    ...(command.payload.update_ready_version === undefined
      ? {}
      : { updateReadyVersion: command.payload.update_ready_version }),
    ...(command.payload.restart_requested_at === undefined
      ? {}
      : { restartRequestedAt: command.payload.restart_requested_at }),
    ...(command.payload.boot_status === undefined
      ? {}
      : { bootStatus: command.payload.boot_status }),
    ...(command.payload.realtime_state === undefined
      ? {}
      : { realtimeState: command.payload.realtime_state }),
    ...(command.payload.processing_state === undefined
      ? {}
      : { processingState: command.payload.processing_state }),
    ...(command.payload.lease_health === undefined
      ? {}
      : { leaseHealth: command.payload.lease_health }),
    ...(command.payload.active_jobs === undefined
      ? {}
      : { activeJobs: command.payload.active_jobs }),
    ...(command.payload.capabilities === undefined
      ? {}
      : { capabilities: command.payload.capabilities }),
    ...(command.payload.logs_supported === undefined
      ? {}
      : { logsSupported: command.payload.logs_supported }),
    ...(command.payload.interval_sec === undefined
      ? {}
      : { intervalSec: command.payload.interval_sec }),
    ...(command.payload.queue_lag_seconds === undefined
      ? {}
      : { queueLagSeconds: command.payload.queue_lag_seconds }),
    ...(command.payload.last_error === undefined ? {} : { lastError: command.payload.last_error }),
    ...(command.payload.status === undefined ? {} : { status: command.payload.status }),
    ...(command.payload.occurred_at === undefined
      ? {}
      : { occurredAt: command.payload.occurred_at }),
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
    ...(activity.metadata === undefined ? {} : { metadata: activity.metadata }),
    ...(activity.occurred_at === undefined ? {} : { occurredAt: activity.occurred_at }),
  }))
}

export function toAgentLogsCommand(command: {
  readonly tenantId: string
  readonly agentId: string
  readonly query: AgentLogsQueryInput
}): Parameters<AgentMonitoringUseCases['getAgentLogs']>[0] {
  return {
    tenantId: command.tenantId,
    agentId: command.agentId,
    channel: command.query.channel,
    tail: command.query.tail,
  }
}

export function toAgentLogIngestCommand(command: {
  readonly tenantId: string
  readonly agentId: string
  readonly payload: AgentLogIngestBodyInput
}): Parameters<AgentMonitoringUseCases['ingestAgentLogs']>[0] {
  return {
    tenantId: command.tenantId,
    agentId: command.agentId,
    lines: command.payload.lines.map((line) => ({
      sequence: line.sequence,
      channel: line.channel,
      message: line.message,
      ...(line.occurred_at === undefined ? {} : { occurredAt: line.occurred_at }),
      ...(line.truncated === undefined ? {} : { truncated: line.truncated }),
    })),
  }
}
