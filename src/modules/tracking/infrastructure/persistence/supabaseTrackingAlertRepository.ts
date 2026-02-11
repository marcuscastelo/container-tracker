import type { NewTrackingAlert, TrackingAlert } from '~/modules/tracking/domain/trackingAlert'
import { TrackingAlertSchema } from '~/modules/tracking/domain/trackingAlert'
import type { TrackingAlertRepository } from '~/modules/tracking/domain/trackingAlertRepository'
import { stringsToJson } from '~/modules/tracking/infrastructure/persistence/toJson'
import type { Tables } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'
import { formatParseError } from '~/shared/utils/formatParseError'

const TABLE = 'tracking_alerts' as const

type TrackingAlertRow = Tables<'tracking_alerts'>

function rowToAlert(
  row: TrackingAlertRow,
): { success: true; data: TrackingAlert } | { success: false; error: Error } {
  function normalizeIso(value: unknown): string | null {
    if (value === null || value === undefined) return null
    // If it's already a Date, return ISO string
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'string') {
      const s = value.trim()
      if (s === '') return null
      // Always attempt to parse into a Date and return canonical ISO (Z) so it matches zod's iso.datetime
      // This converts offsets into Z and normalizes formats like space-separated timestamps.
      // Examples handled: "2026-02-09 15:00:00", "2026-02-09T15:00:00+01:00", "2026-02-09T15:00:00"
      // Try replacing a single space between date and time to help Date parsing
      const candidate = s.replace(/^(.+?) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)(.*)$/, '$1T$2$3')
      const d = new Date(candidate)
      if (!Number.isNaN(d.getTime())) return d.toISOString()
      return null
    }
    return null
  }
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
    detected_at: normalizeIso(row.detected_at),
    triggered_at: normalizeIso(row.triggered_at),
    source_observation_fingerprints: fingerprints,
    retroactive: row.retroactive,
    provider: row.provider,
    acked_at: normalizeIso(row.acked_at),
    dismissed_at: normalizeIso(row.dismissed_at),
  })

  if (!result.success) {
    const err = new Error(`Invalid tracking alert row:\n${formatParseError(result.error)}`)
    return { success: false, error: err }
  }

  return { success: true, data: result.data }
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

    const result = await supabase.from(TABLE).insert(rows).select('*')
    const data = unwrapSupabaseResultOrThrow<any[]>(result, {
      operation: 'insertMany',
      table: TABLE,
    })

    const mapped: TrackingAlert[] = []
    for (const row of data ?? []) {
      const parsed = rowToAlert(row)
      if (parsed.success) mapped.push(parsed.data)
      else
        console.error(
          'supabaseTrackingAlertRepository.insertMany: invalid row skipped',
          parsed.error,
        )
    }

    return mapped
  },

  async findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    const result = await supabase
      .from(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .is('acked_at', null)
      .is('dismissed_at', null)
      .order('triggered_at', { ascending: false })

    const data = unwrapSupabaseResultOrThrow<any[]>(result, {
      operation: 'findActiveByContainerId',
      table: TABLE,
    })

    const mapped: TrackingAlert[] = []
    for (const row of data ?? []) {
      const parsed = rowToAlert(row)
      if (parsed.success) mapped.push(parsed.data)
      else
        console.error(
          'supabaseTrackingAlertRepository.findActiveByContainerId: invalid row skipped',
          parsed.error,
        )
    }

    return mapped
  },

  async findActiveTypesByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    const result = await supabase
      .from(TABLE)
      .select('type')
      .eq('container_id', containerId)
      .is('acked_at', null)
      .is('dismissed_at', null)

    const data = unwrapSupabaseResultOrThrow<any[]>(result, {
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
    // Only throw on real errors; missing data is OK for this update
    unwrapSupabaseSingleOrNull(result, { operation: 'acknowledge', table: TABLE })
  },

  async dismiss(alertId: string, dismissedAt: string): Promise<void> {
    const result = await supabase
      .from(TABLE)
      .update({ dismissed_at: dismissedAt })
      .eq('id', alertId)
    // Only throw on real errors; missing data is OK for this update
    unwrapSupabaseSingleOrNull(result, { operation: 'dismiss', table: TABLE })
  },
}
