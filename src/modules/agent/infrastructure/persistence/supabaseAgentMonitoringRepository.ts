import type { AgentMonitoringRepository } from '~/modules/agent/application/agent-monitoring.repository'
import { toUniqueNormalizedVersions } from '~/modules/agent/application/normalize-blocked-versions'
import { agentMonitoringPersistenceMappers } from '~/modules/agent/infrastructure/persistence/agent-monitoring.persistence.mappers'
import { supabaseServer } from '~/shared/supabase/supabase.server'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (normalized.length === 0) return undefined
  return normalized
}

function escapeForIlike(value: string): string {
  return value.replace(/[%_,]/gu, '')
}

function normalizeCapabilityFilter(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value)
  if (!normalized) return undefined
  return normalized.toLowerCase()
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
}

export const supabaseAgentMonitoringRepository: AgentMonitoringRepository = {
  async listAgentsForTenant({ tenantId, search, capability }) {
    let query = supabaseServer
      .from('tracking_agents')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('revoked_at', null)

    const normalizedSearch = normalizeOptionalString(search)
    if (normalizedSearch) {
      const token = escapeForIlike(normalizedSearch)
      const pattern = `*${token}*`
      const filters = looksLikeUuid(token)
        ? `id.eq.${token},hostname.ilike.${pattern},agent_version.ilike.${pattern},token_id_masked.ilike.${pattern}`
        : `hostname.ilike.${pattern},agent_version.ilike.${pattern},token_id_masked.ilike.${pattern}`
      query = query.or(filters)
    }

    const normalizedCapability = normalizeCapabilityFilter(capability)
    if (normalizedCapability) {
      query = query.filter('capabilities', 'cs', JSON.stringify([normalizedCapability]))
    }

    const result = await query.order('updated_at', { ascending: false })
    const rows = unwrapSupabaseResultOrThrow(result, {
      operation: 'listAgentsForTenant',
      table: 'tracking_agents',
    })

    return rows.map(agentMonitoringPersistenceMappers.fromTrackingAgentRow)
  },

  async getAgentDetailForTenant({ tenantId, agentId }) {
    const result = await supabaseServer
      .from('tracking_agents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', agentId)
      .is('revoked_at', null)
      .maybeSingle()

    const row = unwrapSupabaseSingleOrNull(result, {
      operation: 'getAgentDetailForTenant',
      table: 'tracking_agents',
    })

    if (!row) return null
    return agentMonitoringPersistenceMappers.fromTrackingAgentRow(row)
  },

  async listActivityEventsForAgentsSince({ tenantId, agentIds, sinceIso }) {
    if (agentIds.length === 0) return []

    const result = await supabaseServer
      .from('tracking_agent_activity_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('agent_id', [...agentIds])
      .gte('occurred_at', sinceIso)
      .order('occurred_at', { ascending: false })

    const rows = unwrapSupabaseResultOrThrow(result, {
      operation: 'listActivityEventsForAgentsSince',
      table: 'tracking_agent_activity_events',
    })

    return rows.map(agentMonitoringPersistenceMappers.fromActivityRow)
  },

  async listRecentActivityForAgent({ tenantId, agentId, limit }) {
    const safeLimit = Math.max(1, Math.min(limit, 200))
    const result = await supabaseServer
      .from('tracking_agent_activity_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('agent_id', agentId)
      .order('occurred_at', { ascending: false })
      .limit(safeLimit)

    const rows = unwrapSupabaseResultOrThrow(result, {
      operation: 'listRecentActivityForAgent',
      table: 'tracking_agent_activity_events',
    })

    return rows.map(agentMonitoringPersistenceMappers.fromActivityRow)
  },

  async listRecentLogsForAgent({ tenantId, agentId, channel, tail }) {
    const safeTail = Math.max(1, Math.min(tail, 2000))
    let query = supabaseServer
      .from('agent_log_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('agent_id', agentId)

    if (channel !== 'both') {
      query = query.eq('channel', channel)
    }

    const result = await query.order('sequence', { ascending: false }).limit(safeTail)
    const rows = unwrapSupabaseResultOrThrow(result, {
      operation: 'listRecentLogsForAgent',
      table: 'agent_log_events',
    })

    return rows.map(agentMonitoringPersistenceMappers.fromLogEventRow).reverse()
  },

  async getTenantQueueLagSeconds({ tenantId }) {
    const result = await supabaseServer
      .from('sync_requests')
      .select('created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const row = unwrapSupabaseSingleOrNull(result, {
      operation: 'getTenantQueueLagSeconds',
      table: 'sync_requests',
    })

    if (!row?.created_at) return null
    const createdAt = new Date(row.created_at)
    if (Number.isNaN(createdAt.getTime())) return null

    return Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 1000))
  },

  async authenticateAgentToken({ token }) {
    const result = await supabaseServer
      .from('tracking_agents')
      .select('id,tenant_id,hostname,interval_sec,capabilities')
      .eq('agent_token', token)
      .is('revoked_at', null)
      .maybeSingle()

    const row = unwrapSupabaseSingleOrNull(result, {
      operation: 'authenticateAgentToken',
      table: 'tracking_agents',
    })

    if (!row) return null

    return agentMonitoringPersistenceMappers.toAuthenticatedIdentity(row)
  },

  async updateAgentRuntimeState(command) {
    const result = await supabaseServer
      .from('tracking_agents')
      .update(agentMonitoringPersistenceMappers.toTrackingAgentUpdate(command))
      .eq('id', command.agentId)
      .eq('tenant_id', command.tenantId)
      .is('revoked_at', null)
      .select('*')
      .maybeSingle()

    const row = unwrapSupabaseSingleOrNull(result, {
      operation: 'updateAgentRuntimeState',
      table: 'tracking_agents',
    })

    if (!row) return null

    return agentMonitoringPersistenceMappers.fromTrackingAgentRow(row)
  },

  async getRemoteControlState({ tenantId, agentId }) {
    const agentResult = await supabaseServer
      .from('tracking_agents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', agentId)
      .is('revoked_at', null)
      .maybeSingle()

    const agentRow = unwrapSupabaseSingleOrNull(agentResult, {
      operation: 'getRemoteControlState/tracking_agents',
      table: 'tracking_agents',
    })

    if (!agentRow) {
      return null
    }

    const commandsResult = await supabaseServer
      .from('agent_control_commands')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('agent_id', agentId)
      .is('acknowledged_at', null)
      .order('requested_at', { ascending: true })

    const commandRows = unwrapSupabaseResultOrThrow(commandsResult, {
      operation: 'getRemoteControlState/agent_control_commands',
      table: 'agent_control_commands',
    })

    return {
      policy: agentMonitoringPersistenceMappers.toRemotePolicyRecord(agentRow),
      commands: commandRows.map(agentMonitoringPersistenceMappers.fromControlCommandRow),
    }
  },

  async getInfraConfig({ tenantId, agentId }) {
    const result = await supabaseServer
      .from('tracking_agents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', agentId)
      .is('revoked_at', null)
      .maybeSingle()

    const row = unwrapSupabaseSingleOrNull(result, {
      operation: 'getInfraConfig',
      table: 'tracking_agents',
    })

    if (!row) {
      return null
    }

    return agentMonitoringPersistenceMappers.toInfraConfigRecord(row)
  },

  async acknowledgeRemoteControlCommand({
    tenantId,
    agentId,
    commandId,
    acknowledgedAt,
    status,
    detail,
  }) {
    const result = await supabaseServer
      .from('agent_control_commands')
      .update({
        acknowledged_at: acknowledgedAt,
        acknowledged_status: status,
        acknowledgement_detail: detail,
        acknowledged_by: 'agent-runtime',
      })
      .eq('tenant_id', tenantId)
      .eq('agent_id', agentId)
      .eq('id', commandId)
      .is('acknowledged_at', null)
      .select('id')

    const rows = unwrapSupabaseResultOrThrow(result, {
      operation: 'acknowledgeRemoteControlCommand',
      table: 'agent_control_commands',
    })

    return rows.length > 0
  },

  async requestAgentUpdate({ tenantId, agentId, desiredVersion, updateChannel, requestedAt }) {
    const result = await supabaseServer
      .from('tracking_agents')
      .update({
        desired_version: desiredVersion,
        update_channel: updateChannel,
        updater_state: 'ready',
        updater_last_error: null,
        restart_requested_at: requestedAt,
      })
      .eq('id', agentId)
      .eq('tenant_id', tenantId)
      .is('revoked_at', null)
      .select('*')
      .maybeSingle()

    const row = unwrapSupabaseSingleOrNull(result, {
      operation: 'requestAgentUpdate',
      table: 'tracking_agents',
    })

    if (!row) return null
    return agentMonitoringPersistenceMappers.fromTrackingAgentRow(row)
  },

  async updateAgentRemotePolicy({
    tenantId,
    agentId,
    updatesPaused,
    updateChannel,
    blockedVersions,
    desiredVersion,
  }) {
    const patch = {
      ...(updatesPaused === undefined ? {} : { remote_updates_paused: updatesPaused }),
      ...(updateChannel === undefined ? {} : { update_channel: updateChannel }),
      ...(blockedVersions === undefined
        ? {}
        : { remote_blocked_versions: toUniqueNormalizedVersions(blockedVersions) }),
      ...(desiredVersion === undefined ? {} : { desired_version: desiredVersion }),
    }

    if (Object.keys(patch).length === 0) {
      const currentResult = await supabaseServer
        .from('tracking_agents')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', agentId)
        .is('revoked_at', null)
        .maybeSingle()

      const currentRow = unwrapSupabaseSingleOrNull(currentResult, {
        operation: 'updateAgentRemotePolicy/current',
        table: 'tracking_agents',
      })

      if (!currentRow) return null
      return agentMonitoringPersistenceMappers.fromTrackingAgentRow(currentRow)
    }

    const result = await supabaseServer
      .from('tracking_agents')
      .update(patch)
      .eq('id', agentId)
      .eq('tenant_id', tenantId)
      .is('revoked_at', null)
      .select('*')
      .maybeSingle()

    const row = unwrapSupabaseSingleOrNull(result, {
      operation: 'updateAgentRemotePolicy',
      table: 'tracking_agents',
    })

    if (!row) return null
    return agentMonitoringPersistenceMappers.fromTrackingAgentRow(row)
  },

  async requestAgentRestart({ tenantId, agentId, requestedAt }) {
    const result = await supabaseServer
      .from('tracking_agents')
      .update({
        restart_requested_at: requestedAt,
        updater_state: 'draining',
      })
      .eq('id', agentId)
      .eq('tenant_id', tenantId)
      .is('revoked_at', null)
      .select('*')
      .maybeSingle()

    const row = unwrapSupabaseSingleOrNull(result, {
      operation: 'requestAgentRestart',
      table: 'tracking_agents',
    })

    if (!row) return null

    const commandResult = await supabaseServer
      .from('agent_control_commands')
      .insert({
        tenant_id: tenantId,
        agent_id: agentId,
        command_type: 'RESTART_AGENT',
        requested_at: requestedAt,
        payload: {},
        requested_by: 'control-plane',
      })
      .select('id')

    unwrapSupabaseResultOrThrow(commandResult, {
      operation: 'requestAgentRestart/agent_control_commands',
      table: 'agent_control_commands',
    })

    return agentMonitoringPersistenceMappers.fromTrackingAgentRow(row)
  },

  async requestAgentReset({ tenantId, agentId, requestedAt }) {
    const previousStateResult = await supabaseServer
      .from('tracking_agents')
      .select('restart_requested_at,updater_state')
      .eq('id', agentId)
      .eq('tenant_id', tenantId)
      .is('revoked_at', null)
      .maybeSingle()

    const previousStateRow = unwrapSupabaseSingleOrNull(previousStateResult, {
      operation: 'requestAgentReset/previousState',
      table: 'tracking_agents',
    })

    if (!previousStateRow) return null

    const result = await supabaseServer
      .from('tracking_agents')
      .update({
        restart_requested_at: requestedAt,
        updater_state: 'draining',
      })
      .eq('id', agentId)
      .eq('tenant_id', tenantId)
      .is('revoked_at', null)
      .select('*')
      .maybeSingle()

    const row = unwrapSupabaseSingleOrNull(result, {
      operation: 'requestAgentReset',
      table: 'tracking_agents',
    })

    if (!row) return null

    try {
      const commandResult = await supabaseServer
        .from('agent_control_commands')
        .insert({
          tenant_id: tenantId,
          agent_id: agentId,
          command_type: 'RESET_AGENT',
          requested_at: requestedAt,
          payload: {},
          requested_by: 'control-plane',
        })
        .select('id')

      unwrapSupabaseResultOrThrow(commandResult, {
        operation: 'requestAgentReset/agent_control_commands',
        table: 'agent_control_commands',
      })
    } catch (error) {
      try {
        const rollbackResult = await supabaseServer
          .from('tracking_agents')
          .update({
            restart_requested_at: previousStateRow.restart_requested_at,
            updater_state: previousStateRow.updater_state,
          })
          .eq('id', agentId)
          .eq('tenant_id', tenantId)
          .is('revoked_at', null)
          .select('id')

        unwrapSupabaseResultOrThrow(rollbackResult, {
          operation: 'requestAgentReset/rollback',
          table: 'tracking_agents',
        })
      } catch (rollbackError) {
        const enqueueErrorMessage = error instanceof Error ? error.message : String(error)
        const rollbackErrorMessage =
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        throw new Error(
          `requestAgentReset command enqueue failed and rollback failed: enqueue=${enqueueErrorMessage}; rollback=${rollbackErrorMessage}`,
        )
      }

      throw error
    }

    return agentMonitoringPersistenceMappers.fromTrackingAgentRow(row)
  },

  async insertActivityEvents(events) {
    if (events.length === 0) return

    const rows = events.map(agentMonitoringPersistenceMappers.toActivityInsertRow)
    const result = await supabaseServer
      .from('tracking_agent_activity_events')
      .insert(rows)
      .select('id')

    unwrapSupabaseResultOrThrow(result, {
      operation: 'insertActivityEvents',
      table: 'tracking_agent_activity_events',
    })
  },

  async insertLogEvents(events) {
    if (events.length === 0) {
      return {
        accepted: 0,
        persisted: 0,
      }
    }

    const rows = events.map(agentMonitoringPersistenceMappers.toLogEventInsertRow)
    const result = await supabaseServer
      .from('agent_log_events')
      .upsert(rows, {
        onConflict: 'tenant_id,agent_id,sequence',
        ignoreDuplicates: true,
      })
      .select('id')

    const persistedRows = unwrapSupabaseResultOrThrow(result, {
      operation: 'insertLogEvents',
      table: 'agent_log_events',
    })

    const sample = events[0]
    if (persistedRows.length > 0 && sample !== undefined) {
      const updateResult = await supabaseServer
        .from('tracking_agents')
        .update({
          logs_supported: true,
          last_log_at: new Date().toISOString(),
        })
        .eq('tenant_id', sample.tenantId)
        .eq('id', sample.agentId)
        .is('revoked_at', null)
        .select('id')

      unwrapSupabaseResultOrThrow(updateResult, {
        operation: 'insertLogEvents/updateTrackingAgentMetadata',
        table: 'tracking_agents',
      })
    }

    return {
      accepted: events.length,
      persisted: persistedRows.length,
    }
  },
}
