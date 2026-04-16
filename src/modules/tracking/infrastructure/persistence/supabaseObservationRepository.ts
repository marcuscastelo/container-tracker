import type { ObservationRepository } from '~/modules/tracking/application/ports/tracking.observation.repository'
import type { TrackingSearchObservationProjection } from '~/modules/tracking/application/projection/tracking.search.readmodel'
import type {
  NewObservation,
  Observation,
} from '~/modules/tracking/features/observation/domain/model/observation'
import { compareObservationsChronologically } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import {
  observationRowToDomain,
  observationToInsertRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mappers'
import { measureAuditedReadQuery } from '~/shared/observability/readRequestMetrics'
import { supabase } from '~/shared/supabase/supabase'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'

const TABLE = 'container_observations' as const
const CONTAINERS_TABLE = 'containers' as const
const OBSERVATION_DOMAIN_SELECT =
  'id,fingerprint,container_id,container_number,type,temporal_kind,event_time_instant,event_date,event_time_local,event_time_zone,event_time,event_time_type,location_code,location_display,vessel_name,voyage,is_empty,confidence,provider,created_from_snapshot_id,carrier_label,raw_event_time,event_time_source,created_at,retroactive'

function compareObservationChronology(left: Observation, right: Observation): number {
  const chronologyCompare = compareObservationsChronologically(left, right)
  if (chronologyCompare !== 0) {
    return chronologyCompare
  }

  return left.id.localeCompare(right.id)
}

export const supabaseObservationRepository: ObservationRepository = {
  async insertMany(observations: readonly NewObservation[]): Promise<readonly Observation[]> {
    if (observations.length === 0) return []
    const rows = observations.map(observationToInsertRow)

    const result = await supabase.from(TABLE).insert(rows).select(OBSERVATION_DOMAIN_SELECT)
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'insertMany',
      table: TABLE,
    })

    return (data ?? []).map(observationRowToDomain)
  },
  async findAllByContainerId(containerId: string): Promise<readonly Observation[]> {
    const result = await measureAuditedReadQuery({
      table: TABLE,
      operation: 'findAllByContainerId',
      query: () =>
        supabase
          .from(TABLE)
          .select(OBSERVATION_DOMAIN_SELECT)
          .eq('container_id', containerId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }),
      resultSelector: (queryResult) => queryResult.data ?? [],
    })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findAllByContainerId',
      table: TABLE,
    })

    return (data ?? []).map(observationRowToDomain).sort(compareObservationChronology)
  },

  async findAllByContainerIds(containerIds: readonly string[]): Promise<readonly Observation[]> {
    if (containerIds.length === 0) return []

    const uniqueContainerIds = Array.from(new Set(containerIds))
    const result = await measureAuditedReadQuery({
      table: TABLE,
      operation: 'findAllByContainerIds',
      query: () =>
        supabase
          .from(TABLE)
          .select(OBSERVATION_DOMAIN_SELECT)
          .in('container_id', uniqueContainerIds)
          .order('container_id', { ascending: true })
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }),
      resultSelector: (queryResult) => queryResult.data ?? [],
    })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findAllByContainerIds',
      table: TABLE,
    })

    return [...(data ?? [])].map(observationRowToDomain).sort((left, right) => {
      const containerCompare = left.container_id.localeCompare(right.container_id)
      if (containerCompare !== 0) return containerCompare
      return compareObservationChronology(left, right)
    })
  },

  async findById(containerId: string, observationId: string): Promise<Observation | null> {
    const result = await measureAuditedReadQuery({
      table: TABLE,
      operation: 'findById',
      query: () =>
        supabase
          .from(TABLE)
          .select(OBSERVATION_DOMAIN_SELECT)
          .eq('container_id', containerId)
          .eq('id', observationId)
          .maybeSingle(),
      resultSelector: (queryResult) => queryResult.data,
    })

    const row = unwrapSupabaseSingleOrNull(result, {
      operation: 'findById',
      table: TABLE,
    })

    return row === null ? null : observationRowToDomain(row)
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
    const observationsResult = await measureAuditedReadQuery({
      table: TABLE,
      operation: 'listSearchObservations.observations',
      query: () =>
        supabase
          .from(TABLE)
          .select(OBSERVATION_DOMAIN_SELECT)
          .order('container_id', { ascending: true })
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }),
      resultSelector: (queryResult) => queryResult.data ?? [],
    })

    const observationRows =
      unwrapSupabaseResultOrThrow(observationsResult, {
        operation: 'listSearchObservations.observations',
        table: TABLE,
      }) ?? []

    if (observationRows.length === 0) {
      return []
    }

    const containerIds = Array.from(new Set(observationRows.map((row) => row.container_id)))

    const containersResult = await measureAuditedReadQuery({
      table: CONTAINERS_TABLE,
      operation: 'listSearchObservations.containers',
      query: () => supabase.from(CONTAINERS_TABLE).select('id, process_id').in('id', containerIds),
      resultSelector: (queryResult) => queryResult.data ?? [],
    })

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

    return projections.sort((left, right) => {
      const containerCompare = left.observation.container_id.localeCompare(
        right.observation.container_id,
      )
      if (containerCompare !== 0) {
        return containerCompare
      }

      return compareObservationChronology(left.observation, right.observation)
    })
  },
}
