import type { DerivedObservationState } from '~/modules/tracking/domain/expiredExpected'
import { deriveObservationState } from '~/modules/tracking/domain/expiredExpected'
import type { ObservationResponse } from '~/shared/api-schemas/processes.schemas'
import { formatDateForLocale } from '~/shared/utils/formatDate'

export type EventStatus = 'completed' | 'current' | 'expected' | 'delayed'

export type TimelineEvent = {
  readonly id: string
  readonly label: string
  readonly location?: string
  readonly date: string | null
  readonly date_iso?: string | null
  readonly expectedDate?: string | null
  readonly expectedDate_iso?: string | null
  readonly status: EventStatus
  /** Whether this is an ACTUAL (confirmed) or EXPECTED (predicted) event */
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  /** Derived state for timeline rendering: ACTUAL, ACTIVE_EXPECTED, or EXPIRED_EXPECTED */
  readonly derivedState: DerivedObservationState
  /** Optional i18n key for system-generated events that should be translated in UI */
  readonly labelKey?: string
  /** Optional series history for prediction evolution (Event Series feature) */
  readonly series?: readonly ObservationResponse[]
}

export function observationToTimelineEvent(
  obs: ObservationResponse,
  index: number,
  derivedState: DerivedObservationState = obs.event_time_type === 'ACTUAL'
    ? 'ACTUAL'
    : 'ACTIVE_EXPECTED',
): TimelineEvent {
  const evDate = obs.event_time ? new Date(obs.event_time) : null
  const dateStr = evDate ? formatDateForLocale(evDate) : null
  const eventTimeType = obs.event_time_type ?? 'EXPECTED'
  const isExpected = eventTimeType === 'EXPECTED'
  const expectedDate = isExpected && evDate ? formatDateForLocale(evDate) : undefined

  const dateIso = obs.event_time ?? null
  const expectedDateIso = isExpected && obs.event_time ? obs.event_time : undefined

  // Build location display
  const location = obs.location_display ?? obs.location_code ?? undefined

  // Build label with vessel info if available
  let label = (() => {
    switch (obs.type) {
      case 'GATE_IN':
        return 'Gate In'
      case 'GATE_OUT':
        return 'Gate Out'
      case 'LOAD':
        return 'Loaded on Vessel'
      case 'DEPARTURE':
        return 'Vessel Departed'
      case 'ARRIVAL':
        return 'Arrived at Port'
      case 'DISCHARGE':
        return 'Discharged from Vessel'
      case 'DELIVERY':
        return 'Delivered'
      case 'EMPTY_RETURN':
        return 'Empty Returned'
      case 'CUSTOMS_HOLD':
        return 'Customs Hold'
      case 'CUSTOMS_RELEASE':
        return 'Customs Released'
      default:
        return obs.type
    }
  })()

  if (obs.vessel_name) {
    label += ` — ${obs.vessel_name}`
    if (obs.voyage) label += ` (${obs.voyage})`
  }

  const status: EventStatus = isExpected ? 'expected' : 'completed'

  return {
    id: obs.id ?? `obs-${index}`,
    label,
    location,
    date: isExpected ? null : dateStr,
    date_iso: isExpected ? null : dateIso,
    expectedDate,
    expectedDate_iso: expectedDateIso,
    status,
    eventTimeType,
    derivedState,
  }
}

/**
 * Convert a TimelineItem (with optional series) to a TimelineEvent for UI rendering.
 *
 * This function handles the projection from domain TimelineItem to presentation TimelineEvent,
 * preserving series history when present.
 *
 * @param item - TimelineItem from domain layer
 * @param allObservations - All observations for the container (for deriveObservationState)
 * @param index - Index for fallback ID generation
 * @returns TimelineEvent ready for UI rendering
 */
export function timelineItemToEvent(
  item: { readonly primary: ObservationResponse; readonly series?: readonly ObservationResponse[] },
  allObservations: readonly ObservationResponse[],
  index: number,
): TimelineEvent {
  const derivedState = deriveObservationState(item.primary, allObservations)
  const baseEvent = observationToTimelineEvent(item.primary, index, derivedState)

  // Attach series if present and has more than one observation
  const series = item.series && item.series.length > 1 ? item.series : undefined

  return {
    ...baseEvent,
    series,
  }
}

/**
 * Derive timeline with event series grouping from observations.
 *
 * This is a presentation-layer adapter that applies the event series logic
 * to API response objects, collapsing multiple EXPECTED updates of the same
 * semantic event into a single visible entry with full prediction history.
 *
 * @param observations - Array of observations from API
 * @param now - Reference time for expiration check (defaults to current time)
 * @returns Array of TimelineEvents with series information
 */
export function deriveTimelineWithSeries(
  observations: readonly ObservationResponse[],
  now: Date = new Date(),
): TimelineEvent[] {
  if (observations.length === 0) return []

  // Group observations by series key
  const buildSeriesKey = (obs: ObservationResponse): string => {
    const activity = obs.type
    const location = obs.location_code ?? (obs.location_display ?? '').toUpperCase().trim()
    const vessel = obs.vessel_name ?? ''
    const voyage = obs.voyage ?? ''
    return `${activity}|${location}|${vessel}|${voyage}`
  }

  const groups = new Map<string, ObservationResponse[]>()

  for (const obs of observations) {
    const key = buildSeriesKey(obs)
    const group = groups.get(key)
    if (group) {
      group.push(obs)
    } else {
      groups.set(key, [obs])
    }
  }

  const result: Array<{
    primary: ObservationResponse
    series?: readonly ObservationResponse[]
  }> = []
  const nowIso = now.toISOString()

  for (const series of groups.values()) {
    // Sort series by event_time (ascending), then by created_at
    series.sort((a, b) => {
      if (a.event_time === null && b.event_time === null) {
        return a.created_at.localeCompare(b.created_at)
      }
      if (a.event_time === null) return 1
      if (b.event_time === null) return -1
      const cmp = a.event_time.localeCompare(b.event_time)
      if (cmp !== 0) return cmp

      // Times are equal — ACTUAL before EXPECTED
      if (a.event_time_type === 'ACTUAL' && b.event_time_type === 'EXPECTED') return -1
      if (a.event_time_type === 'EXPECTED' && b.event_time_type === 'ACTUAL') return 1

      return a.created_at.localeCompare(b.created_at)
    })

    // Separate ACTUAL and EXPECTED observations
    const actuals = series.filter((o) => o.event_time_type === 'ACTUAL')
    const expecteds = series.filter((o) => o.event_time_type === 'EXPECTED')

    let primary: ObservationResponse | null = null

    if (actuals.length > 0) {
      // Rule 1: If ACTUAL exists, use the most recent one
      primary = actuals[actuals.length - 1] ?? null
    } else if (expecteds.length > 0) {
      // Rule 2: Use most recent non-expired EXPECTED
      const activeExpecteds = expecteds.filter((exp) => {
        if (exp.event_time === null) return true
        return exp.event_time >= nowIso
      })

      if (activeExpecteds.length > 0) {
        primary = activeExpecteds[activeExpecteds.length - 1] ?? null
      }
    }

    if (primary) {
      result.push({
        primary,
        series: series.length > 1 ? series : undefined,
      })
    }
  }

  // Sort result chronologically by primary event_time
  result.sort((a, b) => {
    const aTime = a.primary.event_time
    const bTime = b.primary.event_time

    if (aTime === null && bTime === null) {
      return a.primary.created_at.localeCompare(b.primary.created_at)
    }
    if (aTime === null) return 1
    if (bTime === null) return -1

    const cmp = aTime.localeCompare(bTime)
    if (cmp !== 0) return cmp

    // For equal times, ACTUAL before EXPECTED
    if (a.primary.event_time_type === 'ACTUAL' && b.primary.event_time_type === 'EXPECTED')
      return -1
    if (a.primary.event_time_type === 'EXPECTED' && b.primary.event_time_type === 'ACTUAL') return 1

    return a.primary.created_at.localeCompare(b.primary.created_at)
  })

  // Convert to TimelineEvents
  return result.map((item, idx) => timelineItemToEvent(item, observations, idx))
}
