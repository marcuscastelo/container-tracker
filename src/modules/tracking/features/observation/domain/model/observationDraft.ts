import type { Provider } from '~/modules/tracking/domain/model/provider'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'

/**
 * EventTimeType — differentiates between confirmed facts and predictions.
 * Imported from observation.ts for consistency.
 */
export type EventTimeType = 'ACTUAL' | 'EXPECTED'

/**
 * Confidence level of an observation.
 * Determined during normalization based on field completeness.
 */
export type Confidence = 'high' | 'medium' | 'low'

/**
 * ObservationDraft — output of normalizeSnapshot, before deduplication.
 *
 * An ObservationDraft is a semantic fact extracted from a carrier snapshot.
 * It does NOT have an `id` or `fingerprint` yet — those are computed
 * during the diff/persist step.
 *
 * @see docs/master-consolidated-0209.md §2.4
 */
export type ObservationDraft = {
  /** Container number this observation refers to */
  container_number: string

  /** Semantic type of observation */
  type: ObservationType

  /** When the event occurred (UTC ISO), null if unknown */
  event_time: string | null

  /**
   * Whether this is an ACTUAL (confirmed) or EXPECTED (predicted) event.
   * Adapters must set this based on explicit carrier data.
   *
   * If carrier doesn't explicitly indicate, use EXPECTED as the safe default.
   */
  event_time_type: EventTimeType

  /** UN/LOCODE or similar location code, null if unknown */
  location_code: string | null

  /** Human-readable location display (e.g. "SANTOS, BR") */
  location_display: string | null

  /** Vessel name, null if not applicable */
  vessel_name: string | null

  /** Voyage number, null if not applicable */
  voyage: string | null

  /** Whether the container was empty at this point */
  is_empty: boolean | null

  /** Confidence level based on field completeness */
  confidence: Confidence

  /** Provider that produced this data */
  provider: Provider

  /** ID of the snapshot this draft was extracted from */
  snapshot_id: string

  /** Original provider event label (for audit/debug), null when unavailable */
  carrier_label?: string | null

  /** Reference to the raw event inside the snapshot payload (for audit) */
  raw_event?: unknown
}
