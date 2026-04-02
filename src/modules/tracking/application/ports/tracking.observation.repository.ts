import type { TrackingSearchObservationProjection } from '~/modules/tracking/application/projection/tracking.search.readmodel'
import type {
  NewObservation,
  Observation,
} from '~/modules/tracking/features/observation/domain/model/observation'

/**
 * Repository interface for Observation persistence.
 *
 * Observations are append-only — never deleted or updated.
 */
export type ObservationRepository = {
  /** Persist new observations. Returns the observations with generated ids and created_at. */
  insertMany(observations: readonly NewObservation[]): Promise<readonly Observation[]>

  /** Fetch all observations for a container, ordered by canonical tracking chronology. */
  findAllByContainerId(containerId: string): Promise<readonly Observation[]>

  /** Fetch all observations for many containers, ordered by container + chronology. */
  findAllByContainerIds(containerIds: readonly string[]): Promise<readonly Observation[]>

  /** Fetch a single observation by container ownership. */
  findById?(containerId: string, observationId: string): Promise<Observation | null>

  /** Fetch the set of fingerprints already persisted for a container. */
  findFingerprintsByContainerId(containerId: string): Promise<ReadonlySet<string>>

  /**
   * Fetch search observations enriched with process ownership.
   *
   * Used by tracking-level search projections so capabilities can consume
   * status/ETA already derived by Tracking BC.
   */
  listSearchObservations(): Promise<readonly TrackingSearchObservationProjection[]>
}
