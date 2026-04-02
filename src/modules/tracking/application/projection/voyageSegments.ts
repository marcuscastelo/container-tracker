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
 * A new segment starts when:
 * - a LOAD event is encountered
 * - or a DEPARTURE EXPECTED event appears with vessel/voyage context and there is no active voyage
 *
 * The segment destination is updated by ARRIVAL/DISCHARGE milestones so predicted legs
 * can expose a temporary destination before an actual discharge exists.
 *
 * Non-maritime events stay outside voyage segments, including transshipment helper events.
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

  function isMaritimeEvent(event: TrackingTimelineItem): boolean {
    return (
      event.type === 'LOAD' ||
      event.type === 'DEPARTURE' ||
      event.type === 'ARRIVAL' ||
      event.type === 'DISCHARGE'
    )
  }

  function canStartPredictedVoyage(event: TrackingTimelineItem): boolean {
    if (event.type !== 'DEPARTURE' || event.eventTimeType !== 'EXPECTED') return false

    return (event.vesselName?.trim().length ?? 0) > 0 || (event.voyage?.trim().length ?? 0) > 0
  }

  function matchesCurrentVoyageIdentity(event: TrackingTimelineItem): boolean {
    const vesselMatches =
      currentVessel === null || event.vesselName === undefined || event.vesselName === currentVessel
    const voyageMatches =
      currentVoyage === null || event.voyage === undefined || event.voyage === currentVoyage

    return vesselMatches && voyageMatches
  }

  function beginVoyage(event: TrackingTimelineItem): void {
    inVoyage = true
    currentVessel = event.vesselName ?? null
    currentVoyage = event.voyage ?? null
    currentOrigin = event.location ?? null
    currentDestination = null
    currentEvents.push(event)
  }

  for (const event of events) {
    if (inVoyage) {
      if (!isMaritimeEvent(event)) {
        flushCurrent()
        currentEvents.push(event)
        continue
      }

      if (event.type === 'LOAD') {
        flushCurrent()
        beginVoyage(event)
        continue
      }

      if (canStartPredictedVoyage(event) && !matchesCurrentVoyageIdentity(event)) {
        flushCurrent()
        beginVoyage(event)
        continue
      }

      currentEvents.push(event)
      if (currentVessel === null && event.vesselName !== undefined) {
        currentVessel = event.vesselName ?? null
      }
      if (currentVoyage === null && event.voyage !== undefined) {
        currentVoyage = event.voyage ?? null
      }
      if (
        currentOrigin === null &&
        (event.type === 'LOAD' || event.type === 'DEPARTURE') &&
        event.location !== undefined
      ) {
        currentOrigin = event.location ?? null
      }
      if (
        (event.type === 'ARRIVAL' || event.type === 'DISCHARGE') &&
        event.location !== undefined
      ) {
        currentDestination = event.location ?? null
      }
      if (event.type === 'DISCHARGE' && event.eventTimeType === 'ACTUAL') {
        flushCurrent()
      }
      continue
    }

    if (event.type === 'LOAD' || canStartPredictedVoyage(event)) {
      flushCurrent()
      beginVoyage(event)
      continue
    }

    currentEvents.push(event)
  }

  // Flush any remaining events
  flushCurrent()

  return segments
}
