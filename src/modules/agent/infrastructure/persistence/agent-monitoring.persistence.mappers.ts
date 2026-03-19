import type {
  AgentActivityEventRecord,
  AgentActivityInsertRecord,
  AgentAuthenticatedIdentity,
  AgentLogEventRecord,
  AgentLogInsertRecord,
  AgentMonitoringRecord,
  AgentRuntimeStateUpdate,
} from '~/modules/agent/application/agent-monitoring.repository'
import type {
  AgentLogEventInsert,
  AgentLogEventRow,
  TrackingAgentActivityEventInsert,
  TrackingAgentActivityEventRow,
  TrackingAgentRow,
  TrackingAgentUpdate,
} from '~/modules/agent/infrastructure/persistence/agent-monitoring.row'

type AgentAuthRow = {
  readonly id: string
  readonly tenant_id: string
  readonly hostname: string
  readonly interval_sec: number
  readonly capabilities: unknown
}

function toAgentStatus(value: string): AgentMonitoringRecord['status'] {
  if (value === 'CONNECTED') return 'CONNECTED'
  if (value === 'DEGRADED') return 'DEGRADED'
  if (value === 'DISCONNECTED') return 'DISCONNECTED'
  return 'UNKNOWN'
}

function toAgentRealtimeState(value: string): AgentMonitoringRecord['realtimeState'] {
  if (value === 'SUBSCRIBED') return 'SUBSCRIBED'
  if (value === 'CHANNEL_ERROR') return 'CHANNEL_ERROR'
  if (value === 'CONNECTING') return 'CONNECTING'
  if (value === 'DISCONNECTED') return 'DISCONNECTED'
  return 'UNKNOWN'
}

function toAgentProcessingState(value: string): AgentMonitoringRecord['processingState'] {
  if (value === 'idle') return 'idle'
  if (value === 'leasing') return 'leasing'
  if (value === 'processing') return 'processing'
  if (value === 'backing_off') return 'backing_off'
  return 'unknown'
}

function toAgentLeaseHealth(value: string): AgentMonitoringRecord['leaseHealth'] {
  if (value === 'healthy') return 'healthy'
  if (value === 'stale') return 'stale'
  if (value === 'conflict') return 'conflict'
  return 'unknown'
}

function toAgentEnrollmentMethod(value: string | null): AgentMonitoringRecord['enrollmentMethod'] {
  if (value === 'bootstrap-token') return 'bootstrap-token'
  if (value === 'manual') return 'manual'
  return 'unknown'
}

function toAgentActivityType(value: string): AgentActivityEventRecord['type'] {
  if (value === 'ENROLLED') return 'ENROLLED'
  if (value === 'HEARTBEAT') return 'HEARTBEAT'
  if (value === 'LEASED_TARGET') return 'LEASED_TARGET'
  if (value === 'SNAPSHOT_INGESTED') return 'SNAPSHOT_INGESTED'
  if (value === 'REQUEST_FAILED') return 'REQUEST_FAILED'
  if (value === 'REALTIME_SUBSCRIBED') return 'REALTIME_SUBSCRIBED'
  if (value === 'REALTIME_CHANNEL_ERROR') return 'REALTIME_CHANNEL_ERROR'
  if (value === 'LEASE_CONFLICT') return 'LEASE_CONFLICT'
  if (value === 'UPDATE_CHECKED') return 'UPDATE_CHECKED'
  if (value === 'UPDATE_AVAILABLE') return 'UPDATE_AVAILABLE'
  if (value === 'UPDATE_DOWNLOAD_STARTED') return 'UPDATE_DOWNLOAD_STARTED'
  if (value === 'UPDATE_DOWNLOAD_COMPLETED') return 'UPDATE_DOWNLOAD_COMPLETED'
  if (value === 'UPDATE_READY') return 'UPDATE_READY'
  if (value === 'UPDATE_APPLY_STARTED') return 'UPDATE_APPLY_STARTED'
  if (value === 'UPDATE_APPLY_FAILED') return 'UPDATE_APPLY_FAILED'
  if (value === 'RESTART_FOR_UPDATE') return 'RESTART_FOR_UPDATE'
  return 'ROLLBACK_EXECUTED'
}

function toAgentActivitySeverity(value: string): AgentActivityEventRecord['severity'] {
  if (value === 'warning') return 'warning'
  if (value === 'danger') return 'danger'
  if (value === 'success') return 'success'
  return 'info'
}

function toAgentLogChannel(value: string): AgentLogEventRecord['channel'] {
  if (value === 'stderr') return 'stderr'
  return 'stdout'
}

function toCapabilities(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return []

  return value.filter((item): item is string => typeof item === 'string')
}

function toAgentBootStatus(value: string): AgentMonitoringRecord['bootStatus'] {
  if (value === 'starting') return 'starting'
  if (value === 'healthy') return 'healthy'
  if (value === 'degraded') return 'degraded'
  return 'unknown'
}

function toAgentUpdaterState(value: string): AgentMonitoringRecord['updaterState'] {
  if (value === 'idle') return 'idle'
  if (value === 'checking') return 'checking'
  if (value === 'downloading') return 'downloading'
  if (value === 'ready') return 'ready'
  if (value === 'draining') return 'draining'
  if (value === 'applying') return 'applying'
  if (value === 'rollback') return 'rollback'
  if (value === 'blocked') return 'blocked'
  if (value === 'error') return 'error'
  return 'unknown'
}

function toNullableInteger(value: number | null | undefined): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return Math.max(0, Math.round(value))
}

export const agentMonitoringPersistenceMappers = {
  fromTrackingAgentRow(row: TrackingAgentRow): AgentMonitoringRecord {
    return {
      agentId: row.id,
      tenantId: row.tenant_id,
      hostname: row.hostname,
      os: row.os,
      version: row.agent_version,
      currentVersion: row.current_version,
      desiredVersion: row.desired_version,
      updateChannel: row.update_channel,
      updaterState: toAgentUpdaterState(row.updater_state),
      updaterLastCheckedAt: row.updater_last_checked_at,
      updaterLastError: row.updater_last_error,
      updateReadyVersion: row.update_ready_version,
      restartRequestedAt: row.restart_requested_at,
      bootStatus: toAgentBootStatus(row.boot_status),
      status: toAgentStatus(row.status),
      enrolledAt: row.enrolled_at,
      lastSeenAt: row.last_seen_at,
      activeJobs: row.active_jobs,
      capabilities: toCapabilities(row.capabilities),
      realtimeState: toAgentRealtimeState(row.realtime_state),
      processingState: toAgentProcessingState(row.processing_state),
      leaseHealth: toAgentLeaseHealth(row.lease_health),
      enrollmentMethod: toAgentEnrollmentMethod(row.enrollment_method),
      tokenIdMasked: row.token_id_masked,
      intervalSec: row.interval_sec,
      lastError: row.last_error,
      queueLagSeconds: row.queue_lag_seconds,
      logsSupported: row.logs_supported,
      lastLogAt: row.last_log_at,
    }
  },

  toAuthenticatedIdentity(row: AgentAuthRow): AgentAuthenticatedIdentity {
    return {
      agentId: row.id,
      tenantId: row.tenant_id,
      hostname: row.hostname,
      intervalSec: row.interval_sec,
      capabilities: toCapabilities(row.capabilities),
    }
  },

  toTrackingAgentUpdate(command: AgentRuntimeStateUpdate): TrackingAgentUpdate {
    return {
      ...(command.hostname !== undefined ? { hostname: command.hostname } : {}),
      ...(command.version !== undefined ? { agent_version: command.version } : {}),
      ...(command.currentVersion !== undefined ? { current_version: command.currentVersion } : {}),
      ...(command.desiredVersion !== undefined ? { desired_version: command.desiredVersion } : {}),
      ...(command.updateChannel !== undefined ? { update_channel: command.updateChannel } : {}),
      ...(command.updaterState !== undefined ? { updater_state: command.updaterState } : {}),
      ...(command.updaterLastCheckedAt !== undefined
        ? { updater_last_checked_at: command.updaterLastCheckedAt }
        : {}),
      ...(command.updaterLastError !== undefined
        ? { updater_last_error: command.updaterLastError }
        : {}),
      ...(command.updateReadyVersion !== undefined
        ? { update_ready_version: command.updateReadyVersion }
        : {}),
      ...(command.restartRequestedAt !== undefined
        ? { restart_requested_at: command.restartRequestedAt }
        : {}),
      ...(command.bootStatus !== undefined ? { boot_status: command.bootStatus } : {}),
      ...(command.status !== undefined ? { status: command.status } : {}),
      ...(command.lastSeenAt !== undefined ? { last_seen_at: command.lastSeenAt } : {}),
      ...(command.realtimeState !== undefined ? { realtime_state: command.realtimeState } : {}),
      ...(command.processingState !== undefined
        ? { processing_state: command.processingState }
        : {}),
      ...(command.leaseHealth !== undefined ? { lease_health: command.leaseHealth } : {}),
      ...(command.activeJobs !== undefined ? { active_jobs: Math.max(0, command.activeJobs) } : {}),
      ...(command.capabilities !== undefined ? { capabilities: [...command.capabilities] } : {}),
      ...(command.intervalSec !== undefined ? { interval_sec: command.intervalSec } : {}),
      ...(command.queueLagSeconds !== undefined
        ? { queue_lag_seconds: toNullableInteger(command.queueLagSeconds) }
        : {}),
      ...(command.lastError !== undefined ? { last_error: command.lastError } : {}),
      ...(command.logsSupported !== undefined ? { logs_supported: command.logsSupported } : {}),
      ...(command.lastLogAt !== undefined ? { last_log_at: command.lastLogAt } : {}),
    }
  },

  fromActivityRow(row: TrackingAgentActivityEventRow): AgentActivityEventRecord {
    return {
      id: row.id,
      agentId: row.agent_id,
      tenantId: row.tenant_id,
      type: toAgentActivityType(row.event_type),
      message: row.message,
      severity: toAgentActivitySeverity(row.severity),
      metadata: row.metadata,
      occurredAt: row.occurred_at,
    }
  },

  toActivityInsertRow(event: AgentActivityInsertRecord): TrackingAgentActivityEventInsert {
    return {
      agent_id: event.agentId,
      tenant_id: event.tenantId,
      event_type: event.type,
      message: event.message,
      severity: event.severity,
      metadata: event.metadata,
      occurred_at: event.occurredAt,
    }
  },

  fromLogEventRow(row: AgentLogEventRow): AgentLogEventRecord {
    return {
      id: row.id,
      agentId: row.agent_id,
      tenantId: row.tenant_id,
      channel: toAgentLogChannel(row.channel),
      message: row.message,
      sequence: row.sequence,
      truncated: row.truncated,
      occurredAt: row.occurred_at,
    }
  },

  toLogEventInsertRow(event: AgentLogInsertRecord): AgentLogEventInsert {
    return {
      agent_id: event.agentId,
      tenant_id: event.tenantId,
      sequence: event.sequence,
      channel: event.channel,
      message: event.message,
      occurred_at: event.occurredAt,
      truncated: event.truncated,
    }
  },
}
