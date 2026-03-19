import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { TemporalValueDto } from '~/shared/time/dto'

/**
 * Timeline — ordered sequence of Observations for a single container.
 *
 * Timeline is a derived view. It does NOT impose linearity:
 * cycles (LOAD → DISCHARGE → LOAD) are natural (transshipment).
 *
 * @see docs/master-consolidated-0209.md §2.5
 */
export type TimelineHole = {
  /** Start of the gap, preserving instant/date semantics explicitly. */
  from: TemporalValueDto | null
  /** End of the gap, preserving instant/date semantics explicitly. */
  to: TemporalValueDto | null
  /** Reason for the gap */
  reason: 'missing_data' | 'gap' | 'missing_eta'
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
