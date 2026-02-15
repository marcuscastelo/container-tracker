import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { NewTrackingAlert, TrackingAlert } from '~/modules/tracking/domain/model/trackingAlert'
import {
  alertRowToDomain,
  alertToInsertRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mappers'
import { supabase } from '~/shared/supabase/supabase'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'

const TABLE = 'tracking_alerts' as const

export const supabaseTrackingAlertRepository: TrackingAlertRepository = {
  async insertMany(alerts: readonly NewTrackingAlert[]): Promise<readonly TrackingAlert[]> {
    if (alerts.length === 0) return []

    const rows = alerts.map(alertToInsertRow)

    const result = await supabase.from(TABLE).insert(rows).select('*')
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'insertMany',
      table: TABLE,
    })

    return (data ?? []).map(alertRowToDomain)
  },

  async findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    const result = await supabase
      .from(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .is('acked_at', null)
      .is('dismissed_at', null)
      .order('triggered_at', { ascending: false })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findActiveByContainerId',
      table: TABLE,
    })

    return (data ?? []).map(alertRowToDomain)
  },

  async findActiveTypesByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    const result = await supabase
      .from(TABLE)
      .select('type')
      .eq('container_id', containerId)
      .is('acked_at', null)
      .is('dismissed_at', null)

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findActiveTypesByContainerId',
      table: TABLE,
    })

    const types = new Set<string>()
    for (const row of data ?? []) {
      if (row && typeof row.type === 'string') types.add(row.type)
    }
    return types
  },

  async acknowledge(alertId: string, ackedAt: string): Promise<void> {
    const result = await supabase.from(TABLE).update({ acked_at: ackedAt }).eq('id', alertId)
    unwrapSupabaseSingleOrNull(result, { operation: 'acknowledge', table: TABLE })
  },

  async dismiss(alertId: string, dismissedAt: string): Promise<void> {
    const result = await supabase
      .from(TABLE)
      .update({ dismissed_at: dismissedAt })
      .eq('id', alertId)
    unwrapSupabaseSingleOrNull(result, { operation: 'dismiss', table: TABLE })
  },
}
