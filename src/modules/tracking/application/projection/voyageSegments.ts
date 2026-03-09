import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'

/**
 * VoyageSegment — a contiguous group of timeline events
 * that belong to the same vessel leg.
 *
 * A voyage begins with a LOAD event and ends with a DISCHARGE event.
 * Events outside a voyage leg are collected into a segment with
 * `vessel: null`.
 *
 * This is a UI projection — it does NOT modify domain data.
 */
export type VoyageSegment = {
  /** Vessel name, null for non-voyage events */
  readonly vessel: string | null
  /** Voyage number, null if unavailable */
  readonly voyage: string | null
  /** Origin port (from the LOAD event location) */
  readonly origin: string | null
  /** Destination port (from the DISCHARGE event location) */
  readonly destination: string | null
  /** Events belonging to this segment, in original order */
  readonly events: readonly TrackingTimelineItem[]
}

/**
 * Groups timeline events into voyage segments.
 *
 * A new segment starts when a LOAD event is encountered.
 * The segment's destination is set when a DISCHARGE event is found.
 * Events before the first LOAD or after a DISCHARGE (before the next LOAD)
 * are collected into a segment with `vessel: null`.
 *
 * @param events - Ordered timeline events for a single container
 * @returns Array of voyage segments preserving event order
 */
export function groupVoyageSegments(
  events: readonly TrackingTimelineItem[],
): readonly VoyageSegment[] {
  if (events.length === 0) return []

  const segments: VoyageSegment[] = []
  let currentEvents: TrackingTimelineItem[] = []
  let currentVessel: string | null = null
  let currentVoyage: string | null = null
  let currentOrigin: string | null = null
  let currentDestination: string | null = null
  let inVoyage = false

  function flushCurrent(): void {
    if (currentEvents.length === 0) return
    segments.push({
      vessel: currentVessel,
      voyage: currentVoyage,
      origin: currentOrigin,
      destination: currentDestination,
      events: currentEvents,
    })
    currentEvents = []
    currentVessel = null
    currentVoyage = null
    currentOrigin = null
    currentDestination = null
    inVoyage = false
  }

  for (const event of events) {
    if (event.type === 'LOAD') {
      // Flush any pre-voyage or previous voyage events
      flushCurrent()
      inVoyage = true
      currentVessel = event.vesselName ?? null
      currentVoyage = event.voyage ?? null
      currentOrigin = event.location ?? null
      currentEvents.push(event)
      continue
    }

    currentEvents.push(event)

    if (event.type === 'DISCHARGE' && inVoyage) {
      currentDestination = event.location ?? null
      flushCurrent()
    }
  }

  // Flush any remaining events
  flushCurrent()

  return segments
}
