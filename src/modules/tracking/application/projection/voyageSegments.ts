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
  /** Planned maritime continuation inferred from intended transshipment context. */
  readonly plannedContinuation: boolean
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

  const TRANSSHIPMENT_HELPER_TYPES = new Set([
    'TRANSSHIPMENT_POSITIONED_IN',
    'TRANSSHIPMENT_POSITIONED_OUT',
    'TERMINAL_MOVE',
  ])

  const segments: VoyageSegment[] = []
  let currentEvents: TrackingTimelineItem[] = []
  let currentVessel: string | null = null
  let currentVoyage: string | null = null
  let currentOrigin: string | null = null
  let currentDestination: string | null = null
  let currentPlannedContinuation = false
  let inVoyage = false

  function flushCurrent(): void {
    if (currentEvents.length === 0) return
    segments.push({
      vessel: currentVessel,
      voyage: currentVoyage,
      origin: currentOrigin,
      destination: currentDestination,
      plannedContinuation: currentPlannedContinuation,
      events: currentEvents,
    })
    currentEvents = []
    currentVessel = null
    currentVoyage = null
    currentOrigin = null
    currentDestination = null
    currentPlannedContinuation = false
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

  function hasVoyageIdentity(event: TrackingTimelineItem): boolean {
    return (event.vesselName?.trim().length ?? 0) > 0 || (event.voyage?.trim().length ?? 0) > 0
  }

  function matchesLocation(event: TrackingTimelineItem, location: string | null): boolean {
    if (location === null) return false
    return event.location === location
  }

  function isPlannedContinuationAnchor(event: TrackingTimelineItem): boolean {
    return event.type === 'TRANSSHIPMENT_INTENDED' && event.eventTimeType === 'EXPECTED'
  }

  function isTransshipmentHelperEvent(event: TrackingTimelineItem): boolean {
    return TRANSSHIPMENT_HELPER_TYPES.has(event.type)
  }

  function findLastStrongMaritimeEvent(startIndex: number): TrackingTimelineItem | null {
    for (let index = startIndex; index >= 0; index--) {
      const candidate = events[index]
      if (candidate !== undefined && isMaritimeEvent(candidate)) {
        return candidate
      }
    }

    return null
  }

  type PlannedContinuationMatch = {
    readonly destination: string
    readonly endIndex: number
  }

  function matchPlannedContinuation(startIndex: number): PlannedContinuationMatch | null {
    const anchor = events[startIndex]
    if (anchor === undefined || !isPlannedContinuationAnchor(anchor)) return null

    const origin = anchor.location ?? null
    if (origin === null) return null

    const previousMaritimeEvent = findLastStrongMaritimeEvent(startIndex - 1)
    if (
      previousMaritimeEvent === null ||
      previousMaritimeEvent.type !== 'DISCHARGE' ||
      previousMaritimeEvent.eventTimeType !== 'ACTUAL' ||
      !matchesLocation(previousMaritimeEvent, origin)
    ) {
      return null
    }

    let destination: string | null = null
    let endIndex = startIndex

    for (let index = startIndex + 1; index < events.length; index++) {
      const event = events[index]
      if (event === undefined) continue

      if (event.type === 'LOAD' || canStartPredictedVoyage(event)) {
        return null
      }

      if (
        isPlannedContinuationAnchor(event) ||
        isTransshipmentHelperEvent(event) ||
        (event.type === 'DEPARTURE' && !hasVoyageIdentity(event))
      ) {
        if (matchesLocation(event, origin)) {
          endIndex = index
          continue
        }
        break
      }

      const eventLocation = event.location ?? null

      if (
        (event.type === 'ARRIVAL' || event.type === 'DISCHARGE') &&
        eventLocation !== null &&
        eventLocation !== origin
      ) {
        destination = eventLocation
        endIndex = index
        continue
      }

      break
    }

    if (destination === null) return null

    return {
      destination,
      endIndex,
    }
  }

  function matchesCurrentVoyageIdentity(event: TrackingTimelineItem): boolean {
    const eventVessel = event.vesselName ?? null
    const eventVoyage = event.voyage ?? null

    const vesselMatches =
      currentVessel === null || eventVessel === null || eventVessel === currentVessel
    const voyageMatches =
      currentVoyage === null || eventVoyage === null || eventVoyage === currentVoyage

    return vesselMatches && voyageMatches
  }

  function beginVoyage(event: TrackingTimelineItem): void {
    inVoyage = true
    currentPlannedContinuation = false
    currentVessel = event.vesselName ?? null
    currentVoyage = event.voyage ?? null
    currentOrigin = event.location ?? null
    currentDestination = null
    currentEvents.push(event)
  }

  for (let index = 0; index < events.length; index++) {
    const event = events[index]
    if (event === undefined) continue

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

    const plannedContinuation = matchPlannedContinuation(index)
    if (plannedContinuation !== null) {
      flushCurrent()
      segments.push({
        vessel: null,
        voyage: null,
        origin: event.location ?? null,
        destination: plannedContinuation.destination,
        plannedContinuation: true,
        events: events.slice(index, plannedContinuation.endIndex + 1),
      })
      index = plannedContinuation.endIndex
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
