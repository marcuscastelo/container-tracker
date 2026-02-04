import type { Json } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import type { Alert, AlertState } from '~/src/modules/alert/domain/alert'
import type { AlertRepository } from '~/src/modules/alert/domain/alertRepository'

const TABLE_NAME = 'alerts'

/**
 * Supabase-backed implementation of AlertRepository.
 */
export const supabaseAlertRepository: AlertRepository = {
  async fetchActive(): Promise<readonly Alert[]> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('state', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('supabaseAlertRepository.fetchActive error:', error)
      throw new Error(`Failed to fetch active alerts: ${error.message}`)
    }

    return (data ?? []).map(rowToAlert)
  },

  async fetchByProcessId(processId: string): Promise<readonly Alert[]> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('process_id', processId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('supabaseAlertRepository.fetchByProcessId error:', error)
      throw new Error(`Failed to fetch alerts for process ${processId}: ${error.message}`)
    }

    return (data ?? []).map(rowToAlert)
  },

  async fetchByContainerId(containerId: string): Promise<readonly Alert[]> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('container_id', containerId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('supabaseAlertRepository.fetchByContainerId error:', error)
      throw new Error(`Failed to fetch alerts for container ${containerId}: ${error.message}`)
    }

    return (data ?? []).map(rowToAlert)
  },

  async fetchById(alertId: string): Promise<Alert | null> {
    const { data, error } = await supabase.from(TABLE_NAME).select('*').eq('id', alertId).single()

    if (error) {
      if (error.code === 'PGRST116') return null
      console.error('supabaseAlertRepository.fetchById error:', error)
      throw new Error(`Failed to fetch alert ${alertId}: ${error.message}`)
    }

    return data ? rowToAlert(data) : null
  },

  async existsActiveByCode(params: {
    code: string
    process_id?: string | null
    container_id?: string | null
  }): Promise<boolean> {
    let query = supabase.from(TABLE_NAME).select('id').eq('code', params.code).eq('state', 'active')

    if (params.process_id) {
      query = query.eq('process_id', params.process_id)
    }
    if (params.container_id) {
      query = query.eq('container_id', params.container_id)
    }

    const { data, error } = await query.limit(1)

    if (error) {
      console.error('supabaseAlertRepository.existsActiveByCode error:', error)
      throw new Error(`Failed to check alert existence: ${error.message}`)
    }

    return (data?.length ?? 0) > 0
  },

  async create(alert: Omit<Alert, 'id' | 'created_at' | 'updated_at'>): Promise<Alert> {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        process_id: alert.process_id,
        container_id: alert.container_id,
        category: alert.category,
        code: alert.code,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        related_event_ids: alert.related_event_ids as unknown as Json,
        state: alert.state,
        created_at: now,
        updated_at: now,
        acknowledged_at: alert.acknowledged_at?.toISOString() ?? null,
        resolved_at: alert.resolved_at?.toISOString() ?? null,
        expires_at: alert.expires_at?.toISOString() ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('supabaseAlertRepository.create error:', error)
      throw new Error(`Failed to create alert: ${error.message}`)
    }

    return rowToAlert(data)
  },

  async createMany(
    alerts: readonly Omit<Alert, 'id' | 'created_at' | 'updated_at'>[],
  ): Promise<readonly Alert[]> {
    if (alerts.length === 0) return []

    const now = new Date().toISOString()
    const inserts = alerts.map((alert) => ({
      process_id: alert.process_id,
      container_id: alert.container_id,
      category: alert.category,
      code: alert.code,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      related_event_ids: alert.related_event_ids as unknown as Json,
      state: alert.state,
      created_at: now,
      updated_at: now,
      acknowledged_at: alert.acknowledged_at?.toISOString() ?? null,
      resolved_at: alert.resolved_at?.toISOString() ?? null,
      expires_at: alert.expires_at?.toISOString() ?? null,
    }))

    const { data, error } = await supabase.from(TABLE_NAME).insert(inserts).select()

    if (error) {
      console.error('supabaseAlertRepository.createMany error:', error)
      throw new Error(`Failed to create alerts: ${error.message}`)
    }

    return (data ?? []).map(rowToAlert)
  },

  async updateState(
    alertId: string,
    state: AlertState,
    extra?: {
      acknowledged_at?: Date | null
      resolved_at?: Date | null
      expires_at?: Date | null
    },
  ): Promise<Alert> {
    const updates: Record<string, unknown> = {
      state,
      updated_at: new Date().toISOString(),
    }

    if (extra?.acknowledged_at !== undefined) {
      updates.acknowledged_at = extra.acknowledged_at?.toISOString() ?? null
    }
    if (extra?.resolved_at !== undefined) {
      updates.resolved_at = extra.resolved_at?.toISOString() ?? null
    }
    if (extra?.expires_at !== undefined) {
      updates.expires_at = extra.expires_at?.toISOString() ?? null
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(updates)
      .eq('id', alertId)
      .select()
      .single()

    if (error) {
      console.error('supabaseAlertRepository.updateState error:', error)
      throw new Error(`Failed to update alert state: ${error.message}`)
    }

    return rowToAlert(data)
  },

  async deleteExpired(): Promise<number> {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .lt('expires_at', now)
      .select('id')

    if (error) {
      console.error('supabaseAlertRepository.deleteExpired error:', error)
      throw new Error(`Failed to delete expired alerts: ${error.message}`)
    }

    return data?.length ?? 0
  },

  async deleteByProcessId(processId: string): Promise<void> {
    const { error } = await supabase.from(TABLE_NAME).delete().eq('process_id', processId)

    if (error) {
      console.error('supabaseAlertRepository.deleteByProcessId error:', error)
      throw new Error(`Failed to delete alerts for process ${processId}: ${error.message}`)
    }
  },
}

// Helper function to convert database row to domain type
function rowToAlert(row: unknown): Alert {
  const r = row as Record<string, unknown>
  return {
    id: String(r.id),
    process_id: r.process_id as string | null,
    container_id: r.container_id as string | null,
    category: r.category as Alert['category'],
    code: r.code as Alert['code'],
    severity: r.severity as Alert['severity'],
    title: String(r.title),
    description: r.description as string | null,
    related_event_ids: (r.related_event_ids as string[]) ?? null,
    state: (r.state as Alert['state']) ?? 'active',
    created_at: new Date(r.created_at as string),
    updated_at: new Date(r.updated_at as string),
    acknowledged_at: r.acknowledged_at ? new Date(r.acknowledged_at as string) : null,
    resolved_at: r.resolved_at ? new Date(r.resolved_at as string) : null,
    expires_at: r.expires_at ? new Date(r.expires_at as string) : null,
  }
}
