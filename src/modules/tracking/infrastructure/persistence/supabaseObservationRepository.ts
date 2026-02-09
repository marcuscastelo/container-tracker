import type { NewObservation, Observation } from '~/modules/tracking/domain/observation'
import { ObservationSchema } from '~/modules/tracking/domain/observation'
import type { ObservationRepository } from '~/modules/tracking/domain/observationRepository'
import type { Tables, TablesInsert } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import { formatParseError } from '~/shared/utils/formatParseError'

const TABLE = 'container_observations' as const

type ObservationRow = Tables<'container_observations'>
type ObservationInsertRow = TablesInsert<'container_observations'>

// TODO: Deduplicate date normalization logic with supabaseSnapshotRepository. Maybe a shared utility for normalizing timestamptz values from Supabase?
// Issue URL: https://github.com/marcuscastelo/container-tracker/issues/19
function normalizeDatetime(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  if (typeof value === 'string') {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
    return value
  }
  return null
}

function rowToObservation(row: ObservationRow): Observation {
  const result = ObservationSchema.safeParse({
    id: row.id,
    fingerprint: row.fingerprint,
    container_id: row.container_id,
    container_number: row.container_number,
    event_time_type: row.event_time_type,
    type: row.type,
    event_time: normalizeDatetime(row.event_time),
    location_code: row.location_code,
    location_display: row.location_display,
    vessel_name: row.vessel_name,
    voyage: row.voyage,
    is_empty: row.is_empty,
    confidence: row.confidence,
    provider: row.provider,
    created_from_snapshot_id: row.created_from_snapshot_id,
    created_at: normalizeDatetime(row.created_at),
    retroactive: row.retroactive,
  } satisfies { [K in keyof Observation]: unknown })

  if (!result.success) {
    throw new Error(`Invalid observation row:\n${formatParseError(result.error)}`)
  }

  return result.data
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
          event_time: obs.event_time == null ? obs.event_time : normalizeDatetime(obs.event_time),
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

    const { data, error } = await supabase.from(TABLE).insert(rows).select('*')

    if (error) {
      throw new Error(`Failed to insert observations: ${error.message}`)
    }

    return (data ?? []).map(rowToObservation)
  },

  async findAllByContainerId(containerId: string): Promise<readonly Observation[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .order('event_time', { ascending: true, nullsFirst: false })

    if (error) {
      throw new Error(`Failed to fetch observations: ${error.message}`)
    }

    return (data ?? []).map(rowToObservation)
  },

  async findFingerprintsByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('fingerprint')
      .eq('container_id', containerId)

    if (error) {
      throw new Error(`Failed to fetch fingerprints: ${error.message}`)
    }

    const fingerprints = new Set<string>()
    for (const row of data ?? []) {
      fingerprints.add(row.fingerprint)
    }
    return fingerprints
  },
}
