import type { NewObservation, Observation } from '~/modules/tracking/domain/observation'
import { ObservationSchema } from '~/modules/tracking/domain/observation'
import type { ObservationRepository } from '~/modules/tracking/domain/observationRepository'
import type { Tables } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import { formatParseError } from '~/shared/utils/formatParseError'

const TABLE = 'container_observations' as const

type ObservationRow = Tables<'container_observations'>

function rowToObservation(row: ObservationRow): Observation {
  const result = ObservationSchema.safeParse({
    id: row.id,
    fingerprint: row.fingerprint,
    container_id: row.container_id,
    container_number: row.container_number,
    type: row.type,
    event_time: row.event_time,
    location_code: row.location_code,
    location_display: row.location_display,
    vessel_name: row.vessel_name,
    voyage: row.voyage,
    is_empty: row.is_empty,
    confidence: row.confidence,
    provider: row.provider,
    created_from_snapshot_id: row.created_from_snapshot_id,
    created_at: row.created_at,
    retroactive: row.retroactive,
  })

  if (!result.success) {
    throw new Error(`Invalid observation row:\n${formatParseError(result.error)}`)
  }

  return result.data
}

export const supabaseObservationRepository: ObservationRepository = {
  async insertMany(observations: readonly NewObservation[]): Promise<readonly Observation[]> {
    if (observations.length === 0) return []

    const rows = observations.map((obs) => ({
      fingerprint: obs.fingerprint,
      container_id: obs.container_id,
      container_number: obs.container_number,
      type: obs.type,
      event_time: obs.event_time,
      location_code: obs.location_code,
      location_display: obs.location_display,
      vessel_name: obs.vessel_name,
      voyage: obs.voyage,
      is_empty: obs.is_empty,
      confidence: obs.confidence,
      provider: obs.provider,
      created_from_snapshot_id: obs.created_from_snapshot_id,
      retroactive: obs.retroactive ?? false,
    }))

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
