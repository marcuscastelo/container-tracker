import type { Provider } from '~/modules/tracking/domain/model/provider'
import type { Confidence } from '~/modules/tracking/features/observation/domain/model/observationDraft'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'

/**
 * EventTimeType — differentiates between confirmed facts and predictions.
 *
 * ACTUAL: A confirmed, factual event that has occurred.
 *         Only ACTUAL events can advance container status definitively.
 *
 * EXPECTED: A prediction, estimate, or planned event.
 *           Can be used for ETA calculations and monitoring alerts,
 *           but does NOT advance container status.
 *
 * @see Issue: Canonical differentiation between ACTUAL vs EXPECTED
 */
type EventTimeType = 'ACTUAL' | 'EXPECTED'

/**
 * Observation — a persisted, deduplicated semantic fact.
 *
 * Observations are the atoms of truth in the system.
 * They are derived from snapshots, fingerprinted, and never deleted.
 *
 * Key properties:
 *   - Immutable once persisted
 *   - Deduplicated by fingerprint
 *   - Always linked to the snapshot that originated them
 *
 * @see docs/master-consolidated-0209.md §2.4
 */
export type Observation = {
  /** Primary key (UUID) */
  id: string

  /** Deterministic fingerprint for deduplication */
  fingerprint: string

  /** Container ID (FK to containers table) */
  container_id: string

  /** Container number (denormalized for queries) */
  container_number: string

  /** Semantic type */
  type: ObservationType

  /** When the event occurred (UTC ISO), null if unknown */
  event_time: string | null

  /**
   * Whether this is an ACTUAL (confirmed) or EXPECTED (predicted) event.
   * Defaults to EXPECTED if carrier data doesn't explicitly indicate.
   *
   * Rules:
   * - ACTUAL events can advance container status
   * - EXPECTED events are informational only (ETA, predictions)
   * - If uncertain, adapters should use EXPECTED and generate Alert[data]
   */
  event_time_type: EventTimeType

  /** UN/LOCODE */
  location_code: string | null

  /** Human-readable location */
  location_display: string | null

  /** Vessel name */
  vessel_name: string | null

  /** Voyage number */
  voyage: string | null

  /** Whether the container was empty */
  is_empty: boolean | null

  /** Confidence level */
  confidence: Confidence

  /** Provider that produced this data */
  provider: Provider

  /** Snapshot that first introduced this observation */
  created_from_snapshot_id: string

  /** Original provider event label preserved for auditability */
  carrier_label?: string | null

  /** When the observation was first persisted (UTC ISO) */
  created_at: string

  /** Whether this observation was derived from a backfill/retroactive snapshot */
  retroactive?: boolean
}

/**
 * Shape for inserting — omits server-generated fields.
 */
export type NewObservation = Omit<Observation, 'id' | 'created_at'>
