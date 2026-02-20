import { resolveLocationDisplay } from '~/modules/tracking/application/projection/locationDisplayResolver'
import type { TrackingObservationDTO } from '~/modules/tracking/application/projection/tracking.observation.dto'
import {
  buildSeriesKey,
  compareObservationsChronologically,
} from '~/modules/tracking/domain/derive/deriveTimeline'
import type { DerivedObservationState } from '~/modules/tracking/domain/reconcile/expiredExpected'
import { deriveObservationState } from '~/modules/tracking/domain/reconcile/expiredExpected'
import { classifySeries } from '~/modules/tracking/domain/reconcile/seriesClassification'

export type TrackingTimelineItem = {
  readonly id: string
  readonly type: TrackingObservationDTO['type']
  readonly location?: string
  /** ISO timestamp coming from obs.event_time */
  readonly eventTimeIso: string | null
  /** ACTUAL or EXPECTED */
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  /** Derived state for safe-first rendering */
  readonly derivedState: DerivedObservationState

  /** Optional vessel info (kept raw, UI decides formatting) */
  readonly vesselName?: string | null
  readonly voyage?: string | null

  /** Optional series history for prediction evolution */
  readonly series?: readonly TrackingObservationDTO[]
}

export function observationToTrackingTimelineItem(
  obs: TrackingObservationDTO,
  index: number,
  derivedState: DerivedObservationState = obs.event_time_type === 'ACTUAL'
    ? 'ACTUAL'
    : 'ACTIVE_EXPECTED',
): TrackingTimelineItem {
  const eventTimeType = obs.event_time_type ?? 'EXPECTED'

  const location = resolveLocationDisplay({
    location_code: obs.location_code,
    location_display: obs.location_display,
  })

  return {
    id: obs.id ?? `obs-${index}`,
    type: obs.type,
    location,
    eventTimeIso: obs.event_time ?? null,
    eventTimeType,
    derivedState,
    vesselName: obs.vessel_name ?? null,
    voyage: obs.voyage ?? null,
  }
}

export function timelineItemToTrackingItem(
  item: {
    readonly primary: TrackingObservationDTO
    readonly series?: readonly TrackingObservationDTO[]
  },
  allObservations: readonly TrackingObservationDTO[],
  index: number,
): TrackingTimelineItem {
  const derivedState = deriveObservationState(item.primary, allObservations)
  const base = observationToTrackingTimelineItem(item.primary, index, derivedState)

  const series = item.series && item.series.length > 1 ? item.series : undefined
  return { ...base, series }
}

/**
 * Derive timeline with event series grouping from observations.
 *
 * Tracking application-layer read model:
 * - groups observations into semantic series
 * - selects safe-first primary (canonical series classification)
 * - attaches series history
 *
 * No UI strings, no locale formatting.
 */
export function deriveTimelineWithSeriesReadModel(
  observations: readonly TrackingObservationDTO[],
  now: Date = new Date(),
): TrackingTimelineItem[] {
  if (observations.length === 0) return []

  const groups = new Map<string, TrackingObservationDTO[]>()

  for (const obs of observations) {
    const key = buildSeriesKey(obs)
    const group = groups.get(key)
    if (group) group.push(obs)
    else groups.set(key, [obs])
  }

  const result: Array<{
    primary: TrackingObservationDTO
    series?: readonly TrackingObservationDTO[]
  }> = []

  for (const series of groups.values()) {
    series.sort(compareObservationsChronologically)
    const classification = classifySeries(series, now)

    if (classification.primary) {
      result.push({
        primary: classification.primary,
        series: series.length > 1 ? series : undefined,
      })
    }
  }

  result.sort((a, b) => compareObservationsChronologically(a.primary, b.primary))

  return result.map((item, idx) => timelineItemToTrackingItem(item, observations, idx))
}
