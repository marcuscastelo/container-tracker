import type { Observation } from '~/modules/tracking/domain/observation'

/**
 * Timeline — ordered sequence of Observations for a single container.
 *
 * Timeline is a derived view. It does NOT impose linearity:
 * cycles (LOAD → DISCHARGE → LOAD) are natural (transshipment).
 *
 * @see docs/master-consolidated-0209.md §2.5
 */
export type TimelineHole = {
  /** Start of the gap (ISO datetime, null if from beginning) */
  from: string | null
  /** End of the gap (ISO datetime, null if to present) */
  to: string | null
  /** Reason for the gap */
  reason: 'missing_data' | 'gap' | 'missing_eta'
}

/**
 * TimelineItem — projection layer abstraction for timeline entries.
 *
 * Represents either a semantic event (with optional series history)
 * or an explicit hole in the timeline.
 *
 * This is a projection-level type — it does NOT modify persistence.
 *
 * @see Issue: Event Series & Prediction History
 */
export type TimelineItem =
  | {
      readonly kind: 'event'
      /** The visible observation in the timeline */
      readonly primary: Observation
      /** Full series history (if multiple observations exist for this semantic event) */
      readonly series?: readonly Observation[]
    }
  | {
      readonly kind: 'hole'
      readonly from: string | null
      readonly to: string | null
      readonly reason: 'gap' | 'missing_data'
    }

/**
 * Timeline is a runtime-only structure (not persisted).
 * It aggregates observations ordered by event_time.
 */
export type Timeline = {
  readonly container_id: string
  readonly container_number: string
  /** Observations ordered by event_time (nulls last), then by creation order */
  readonly observations: readonly Observation[]
  /** When this timeline was derived (ISO datetime) */
  readonly derived_at: string
  /** Explicit gaps detected in the sequence */
  readonly holes: readonly TimelineHole[]
}
