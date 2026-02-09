import type { NewObservation, Observation } from '~/modules/tracking/domain/observation'
import { ObservationSchema } from '~/modules/tracking/domain/observation'
import type { ObservationRepository } from '~/modules/tracking/domain/observationRepository'
import { fromUntypedTable } from '~/modules/tracking/infrastructure/persistence/supabaseUntypedTable'

// Table name — will be created by the user in Supabase.
// Expected columns:
//   id: uuid (PK, default gen_random_uuid())
//   fingerprint: text (unique per container)
//   container_id: uuid (FK to containers)
//   container_number: text
//   type: text
//   event_time: timestamptz nullable
//   location_code: text nullable
//   location_display: text nullable
//   vessel_name: text nullable
//   voyage: text nullable
//   is_empty: boolean nullable
//   confidence: text
//   provider: text
//   created_from_snapshot_id: uuid (FK to container_snapshots)
//   created_at: timestamptz (default now())
//   retroactive: boolean (default false)
const TABLE = 'container_observations'

function rowToObservation(row: unknown): Observation {
  // fromUntypedTable returns untyped data — we validate everything through Zod
  const r = row as Record<string, unknown>
  const result = ObservationSchema.safeParse({
    id: r.id,
    fingerprint: r.fingerprint,
    container_id: r.container_id,
    container_number: r.container_number,
    type: r.type,
    event_time: r.event_time,
    location_code: r.location_code,
    location_display: r.location_display,
    vessel_name: r.vessel_name,
    voyage: r.voyage,
    is_empty: r.is_empty,
    confidence: r.confidence,
    provider: r.provider,
    created_from_snapshot_id: r.created_from_snapshot_id,
    created_at: r.created_at,
    retroactive: (r.retroactive as boolean | null) ?? false,
  })

  if (!result.success) {
    throw new Error(`Invalid observation row: ${JSON.stringify(result.error)}`)
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

    const { data, error } = await fromUntypedTable(TABLE).insert(rows).select('*')

    if (error) {
      throw new Error(`Failed to insert observations: ${error.message}`)
    }

    return ((data ?? []) as unknown[]).map(rowToObservation)
  },

  async findAllByContainerId(containerId: string): Promise<readonly Observation[]> {
    const { data, error } = await fromUntypedTable(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .order('event_time', { ascending: true, nullsFirst: false })

    if (error) {
      throw new Error(`Failed to fetch observations: ${error.message}`)
    }

    return ((data ?? []) as unknown[]).map(rowToObservation)
  },

  async findFingerprintsByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    const { data, error } = await fromUntypedTable(TABLE)
      .select('fingerprint')
      .eq('container_id', containerId)

    if (error) {
      throw new Error(`Failed to fetch fingerprints: ${error.message}`)
    }

    const fingerprints = new Set<string>()
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      if (typeof row.fingerprint === 'string') {
        fingerprints.add(row.fingerprint)
      }
    }
    return fingerprints
  },
}
