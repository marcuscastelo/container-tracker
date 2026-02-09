import type { NewTrackingAlert, TrackingAlert } from '~/modules/tracking/domain/trackingAlert'
import { TrackingAlertSchema } from '~/modules/tracking/domain/trackingAlert'
import type { TrackingAlertRepository } from '~/modules/tracking/domain/trackingAlertRepository'
import { stringsToJson } from '~/modules/tracking/infrastructure/persistence/toJson'
import type { Tables } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import { formatParseError } from '~/shared/utils/formatParseError'

const TABLE = 'tracking_alerts' as const

type TrackingAlertRow = Tables<'tracking_alerts'>

function rowToAlert(row: TrackingAlertRow): TrackingAlert {
  // Parse source_observation_fingerprints from jsonb
  let fingerprints: string[] = []
  if (Array.isArray(row.source_observation_fingerprints)) {
    fingerprints = row.source_observation_fingerprints.filter(
      (v): v is string => typeof v === 'string',
    )
  }

  const result = TrackingAlertSchema.safeParse({
    id: row.id,
    container_id: row.container_id,
    category: row.category,
    type: row.type,
    severity: row.severity,
    message: row.message,
    detected_at: row.detected_at,
    triggered_at: row.triggered_at,
    source_observation_fingerprints: fingerprints,
    retroactive: row.retroactive,
    provider: row.provider,
    acked_at: row.acked_at,
    dismissed_at: row.dismissed_at,
  })

  if (!result.success) {
    throw new Error(`Invalid tracking alert row:\n${formatParseError(result.error)}`)
  }

  return result.data
}

export const supabaseTrackingAlertRepository: TrackingAlertRepository = {
  async insertMany(alerts: readonly NewTrackingAlert[]): Promise<readonly TrackingAlert[]> {
    if (alerts.length === 0) return []

    const rows = alerts.map((a) => ({
      container_id: a.container_id,
      category: a.category,
      type: a.type,
      severity: a.severity,
      message: a.message,
      detected_at: a.detected_at,
      triggered_at: a.triggered_at,
      source_observation_fingerprints: stringsToJson(a.source_observation_fingerprints),
      retroactive: a.retroactive,
      provider: a.provider,
      acked_at: a.acked_at,
      dismissed_at: a.dismissed_at,
    }))

    const { data, error } = await supabase.from(TABLE).insert(rows).select('*')

    if (error) {
      throw new Error(`Failed to insert tracking alerts: ${error.message}`)
    }

    return (data ?? []).map(rowToAlert)
  },

  async findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .is('acked_at', null)
      .is('dismissed_at', null)
      .order('triggered_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch active tracking alerts: ${error.message}`)
    }

    return (data ?? []).map(rowToAlert)
  },

  async findActiveTypesByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('type')
      .eq('container_id', containerId)
      .is('acked_at', null)
      .is('dismissed_at', null)

    if (error) {
      throw new Error(`Failed to fetch active alert types: ${error.message}`)
    }

    const types = new Set<string>()
    for (const row of data ?? []) {
      types.add(row.type)
    }
    return types
  },

  async acknowledge(alertId: string, ackedAt: string): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ acked_at: ackedAt }).eq('id', alertId)

    if (error) {
      throw new Error(`Failed to acknowledge alert ${alertId}: ${error.message}`)
    }
  },

  async dismiss(alertId: string, dismissedAt: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({ dismissed_at: dismissedAt })
      .eq('id', alertId)

    if (error) {
      throw new Error(`Failed to dismiss alert ${alertId}: ${error.message}`)
    }
  },
}
