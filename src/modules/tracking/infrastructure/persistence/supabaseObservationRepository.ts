import type { ObservationRepository } from '~/modules/tracking/application/tracking.observation.repository'
import type { NewObservation, Observation } from '~/modules/tracking/domain/observation'
import {
  observationRowToDomain,
  observationToInsertRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mappers'
import { supabase } from '~/shared/supabase/supabase'
import { unwrapSupabaseResultOrThrow } from '~/shared/supabase/unwrapSupabaseResult'

const TABLE = 'container_observations' as const

export const supabaseObservationRepository: ObservationRepository = {
  async insertMany(observations: readonly NewObservation[]): Promise<readonly Observation[]> {
    if (observations.length === 0) return []
    const rows = observations.map(observationToInsertRow)

    const result = await supabase.from(TABLE).insert(rows).select('*')
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'insertMany',
      table: TABLE,
    })

    return (data ?? []).map(observationRowToDomain)
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

    return (data ?? []).map(observationRowToDomain)
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
