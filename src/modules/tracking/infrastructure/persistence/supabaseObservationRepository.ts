import type { ObservationRepository } from '~/modules/tracking/application/ports/tracking.observation.repository'
import type { TrackingSearchObservationProjection } from '~/modules/tracking/application/projection/tracking.search.readmodel'
import type {
  NewObservation,
  Observation,
} from '~/modules/tracking/features/observation/domain/model/observation'
import {
  observationRowToDomain,
  observationToInsertRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mappers'
import { supabase } from '~/shared/supabase/supabase'
import { unwrapSupabaseResultOrThrow } from '~/shared/supabase/unwrapSupabaseResult'

const TABLE = 'container_observations' as const
const CONTAINERS_TABLE = 'containers' as const

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

  async listSearchObservations(): Promise<readonly TrackingSearchObservationProjection[]> {
    const observationsResult = await supabase
      .from(TABLE)
      .select('*')
      .order('container_id', { ascending: true })
      .order('event_time', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    const observationRows =
      unwrapSupabaseResultOrThrow(observationsResult, {
        operation: 'listSearchObservations.observations',
        table: TABLE,
      }) ?? []

    if (observationRows.length === 0) {
      return []
    }

    const containerIds = Array.from(new Set(observationRows.map((row) => row.container_id)))

    const containersResult = await supabase
      .from(CONTAINERS_TABLE)
      .select('id, process_id')
      .in('id', containerIds)

    const containerRows =
      unwrapSupabaseResultOrThrow(containersResult, {
        operation: 'listSearchObservations.containers',
        table: CONTAINERS_TABLE,
      }) ?? []

    const processIdByContainerId = new Map<string, string>()
    for (const row of containerRows) {
      processIdByContainerId.set(row.id, row.process_id)
    }

    const projections: TrackingSearchObservationProjection[] = []
    for (const row of observationRows) {
      const processId = processIdByContainerId.get(row.container_id)
      if (!processId) continue

      projections.push({
        processId,
        observation: observationRowToDomain(row),
      })
    }

    return projections
  },
}
