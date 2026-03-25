import type { AgentMonitoringRepository } from '~/modules/agent/application/agent-monitoring.repository'
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
