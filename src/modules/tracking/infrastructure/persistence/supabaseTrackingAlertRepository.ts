import type { NewTrackingAlert, TrackingAlert } from '~/modules/tracking/domain/trackingAlert'
import { TrackingAlertSchema } from '~/modules/tracking/domain/trackingAlert'
import type { TrackingAlertRepository } from '~/modules/tracking/domain/trackingAlertRepository'
import { fromUntypedTable } from '~/modules/tracking/infrastructure/persistence/supabaseUntypedTable'

// Table name — will be created by the user in Supabase.
// Expected columns:
//   id: uuid (PK, default gen_random_uuid())
//   container_id: uuid (FK to containers)
//   category: text ('fact' or 'monitoring')
//   type: text
//   severity: text
//   message: text
//   detected_at: timestamptz
//   triggered_at: timestamptz
//   source_observation_fingerprints: jsonb (array of strings)
//   retroactive: boolean (default false)
//   provider: text nullable
//   acked_at: timestamptz nullable
//   dismissed_at: timestamptz nullable
const TABLE = 'tracking_alerts'

function rowToAlert(row: unknown): TrackingAlert {
  // fromUntypedTable returns untyped data — we validate everything through Zod
  const r = row as Record<string, unknown>

  // Parse source_observation_fingerprints from jsonb
  let fingerprints: string[] = []
  if (Array.isArray(r.source_observation_fingerprints)) {
    fingerprints = r.source_observation_fingerprints.filter(
      (v): v is string => typeof v === 'string',
    )
  }

  const result = TrackingAlertSchema.safeParse({
    id: r.id,
    container_id: r.container_id,
    category: r.category,
    type: r.type,
    severity: r.severity,
    message: r.message,
    detected_at: r.detected_at,
    triggered_at: r.triggered_at,
    source_observation_fingerprints: fingerprints,
    retroactive: (r.retroactive as boolean | null) ?? false,
    provider: r.provider,
    acked_at: r.acked_at,
    dismissed_at: r.dismissed_at,
  })

  if (!result.success) {
    throw new Error(`Invalid tracking alert row: ${JSON.stringify(result.error)}`)
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
      source_observation_fingerprints: a.source_observation_fingerprints,
      retroactive: a.retroactive,
      provider: a.provider,
      acked_at: a.acked_at,
      dismissed_at: a.dismissed_at,
    }))

    const { data, error } = await fromUntypedTable(TABLE).insert(rows).select('*')

    if (error) {
      throw new Error(`Failed to insert tracking alerts: ${error.message}`)
    }

    return ((data ?? []) as unknown[]).map(rowToAlert)
  },

  async findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    const { data, error } = await fromUntypedTable(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .is('acked_at', null)
      .is('dismissed_at', null)
      .order('triggered_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch active tracking alerts: ${error.message}`)
    }

    return ((data ?? []) as unknown[]).map(rowToAlert)
  },

  async findActiveTypesByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    const { data, error } = await fromUntypedTable(TABLE)
      .select('type')
      .eq('container_id', containerId)
      .is('acked_at', null)
      .is('dismissed_at', null)

    if (error) {
      throw new Error(`Failed to fetch active alert types: ${error.message}`)
    }

    const types = new Set<string>()
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      if (typeof row.type === 'string') {
        types.add(row.type)
      }
    }
    return types
  },

  async acknowledge(alertId: string, ackedAt: string): Promise<void> {
    const { error } = await fromUntypedTable(TABLE).update({ acked_at: ackedAt }).eq('id', alertId)

    if (error) {
      throw new Error(`Failed to acknowledge alert ${alertId}: ${error.message}`)
    }
  },

  async dismiss(alertId: string, dismissedAt: string): Promise<void> {
    const { error } = await fromUntypedTable(TABLE)
      .update({ dismissed_at: dismissedAt })
      .eq('id', alertId)

    if (error) {
      throw new Error(`Failed to dismiss alert ${alertId}: ${error.message}`)
    }
  },
}
