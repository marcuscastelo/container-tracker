import type { ObservationRepository } from '~/modules/tracking/application/tracking.observation.repository'
import type { NewObservation, Observation } from '~/modules/tracking/domain/observation'
import { ObservationSchema } from '~/modules/tracking/domain/observation'
import type { Tables, TablesInsert } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import { unwrapSupabaseResultOrThrow } from '~/shared/supabase/unwrapSupabaseResult'
import { formatParseError } from '~/shared/utils/formatParseError'
import { normalizeTimestamptz } from '~/shared/utils/normalizeTimestamptz'

const TABLE = 'container_observations' as const

type ObservationRow = Tables<'container_observations'>
type ObservationInsertRow = TablesInsert<'container_observations'>

function rowToObservation(
  row: ObservationRow,
): { success: true; data: Observation } | { success: false; error: Error } {
  const result = ObservationSchema.safeParse({
    id: row.id,
    fingerprint: row.fingerprint,
    container_id: row.container_id,
    container_number: row.container_number,
    event_time_type: row.event_time_type,
    type: row.type,
    event_time: normalizeTimestamptz(row.event_time),
    location_code: row.location_code,
    location_display: row.location_display,
    vessel_name: row.vessel_name,
    voyage: row.voyage,
    is_empty: row.is_empty,
    confidence: row.confidence,
    provider: row.provider,
    created_from_snapshot_id: row.created_from_snapshot_id,
    created_at: normalizeTimestamptz(row.created_at),
    retroactive: row.retroactive,
  } satisfies { [K in keyof Observation]: unknown })

  if (!result.success) {
    const err = new Error(`Invalid observation row:\n${formatParseError(result.error)}`)
    return { success: false, error: err }
  }

  return { success: true, data: result.data }
}

export const supabaseObservationRepository: ObservationRepository = {
  async insertMany(observations: readonly NewObservation[]): Promise<readonly Observation[]> {
    if (observations.length === 0) return []
    const rows = observations.map(
      (obs) =>
        ({
          fingerprint: obs.fingerprint,
          container_id: obs.container_id,
          container_number: obs.container_number,
          type: obs.type,
          event_time:
            obs.event_time == null ? obs.event_time : normalizeTimestamptz(obs.event_time),
          location_code: obs.location_code,
          location_display: obs.location_display,
          vessel_name: obs.vessel_name,
          voyage: obs.voyage,
          is_empty: obs.is_empty,
          confidence: obs.confidence,
          provider: obs.provider,
          created_from_snapshot_id: obs.created_from_snapshot_id,
          retroactive: obs.retroactive ?? false,
          event_time_type: obs.event_time_type,
        }) satisfies ObservationInsertRow,
    )

    const result = await supabase.from(TABLE).insert(rows).select('*')
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'insertMany',
      table: TABLE,
    })
    const mapped: Observation[] = []
    for (const row of data ?? []) {
      const parsed = rowToObservation(row)
      if (parsed.success) mapped.push(parsed.data)
      else
        console.error('supabaseObservationRepository.insertMany: invalid row skipped', parsed.error)
    }

    return mapped
  },
  async findAllByContainerId(containerId: string): Promise<readonly Observation[]> {
    const result = await supabase
      .from(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .order('event_time', { ascending: true, nullsFirst: false })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findAllByContainerId',
      table: TABLE,
    })

    const mapped: Observation[] = []
    for (const row of data ?? []) {
      const parsed = rowToObservation(row)
      if (parsed.success) mapped.push(parsed.data)
      else
        console.error(
          'supabaseObservationRepository.findAllByContainerId: invalid row skipped',
          parsed.error,
        )
    }

    return mapped
  },

  async findFingerprintsByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    const result = await supabase.from(TABLE).select('fingerprint').eq('container_id', containerId)
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findFingerprintsByContainerId',
      table: TABLE,
    })

    const fingerprints = new Set<string>()
    for (const row of data ?? []) {
      if (row && typeof row.fingerprint === 'string') fingerprints.add(row.fingerprint)
    }
    return fingerprints
  },
}
