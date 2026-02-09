import z from 'zod/v4'
import type { Observation } from '~/modules/tracking/domain/observation'

/**
 * Timeline — ordered sequence of Observations for a single container.
 *
 * Timeline is a derived view. It does NOT impose linearity:
 * cycles (LOAD → DISCHARGE → LOAD) are natural (transshipment).
 *
 * @see docs/master-consolidated-0209.md §2.5
 */
export const TimelineHoleSchema = z.object({
  /** Start of the gap (ISO datetime, null if from beginning) */
  from: z.iso.datetime().nullable(),
  /** End of the gap (ISO datetime, null if to present) */
  to: z.iso.datetime().nullable(),
  /** Reason for the gap */
  reason: z.enum(['missing_data', 'gap', 'missing_eta']),
})

export type TimelineHole = z.infer<typeof TimelineHoleSchema>

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
