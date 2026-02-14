import {
  buildSeriesKey,
  compareObservationsChronologically,
} from '~/modules/tracking/domain/deriveTimeline'
import type { DerivedObservationState } from '~/modules/tracking/domain/expiredExpected'
import { deriveObservationState } from '~/modules/tracking/domain/expiredExpected'
import { classifySeries } from '~/modules/tracking/domain/seriesClassification'
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
 * @internal Used by deriveTimelineWithSeries and tests
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
 * Uses the canonical series classification logic to:
 * - Select safe-first primary (latest ACTUAL, or latest valid EXPECTED)
 * - Detect and warn about conflicting ACTUAL entries
 * - Filter redundant EXPECTED after ACTUAL confirmation
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

  for (const series of groups.values()) {
    // Sort series chronologically
    series.sort(compareObservationsChronologically)

    // Use canonical classification to determine primary
    const classification = classifySeries(series, now)

    if (classification.primary) {
      result.push({
        primary: classification.primary,
        series: series.length > 1 ? series : undefined,
      })
    }
  }

  // Sort result chronologically by primary event_time
  result.sort((a, b) => compareObservationsChronologically(a.primary, b.primary))

  // Convert to TimelineEvents
  return result.map((item, idx) => timelineItemToEvent(item, observations, idx))
}
