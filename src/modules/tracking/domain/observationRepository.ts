import type { NewObservation, Observation } from '~/modules/tracking/domain/observation'
import type { SupabaseResult } from '~/shared/supabase/supabaseResult'

/**
 * Repository interface for Observation persistence.
 *
 * Observations are append-only — never deleted or updated.
 */
export type ObservationRepository = {
  /** Persist new observations. Returns the observations with generated ids and created_at. */
  insertMany(
    observations: readonly NewObservation[],
  ): Promise<SupabaseResult<readonly Observation[]>>

  /** Fetch all observations for a container, ordered by event_time asc. */
  findAllByContainerId(containerId: string): Promise<SupabaseResult<readonly Observation[]>>

  /** Fetch the set of fingerprints already persisted for a container. */
  findFingerprintsByContainerId(containerId: string): Promise<SupabaseResult<ReadonlySet<string>>>
}
