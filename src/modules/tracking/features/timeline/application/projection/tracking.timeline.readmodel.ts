import { resolveLocationDisplay } from '~/modules/tracking/application/projection/locationDisplayResolver'
import { trackingTemporalValueToDto } from '~/modules/tracking/domain/temporal/tracking-temporal'
import type { TrackingObservationProjection } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import {
  type DerivedObservationState,
  deriveObservationState,
} from '~/modules/tracking/features/series/domain/reconcile/expiredExpected'
import {
  classifySeries,
  type SeriesLabel,
} from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
import {
  buildSeriesKey,
  compareObservationsChronologically,
} from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { systemClock } from '~/shared/time/clock'
import type { TemporalValueDto } from '~/shared/time/dto'
import type { Instant } from '~/shared/time/instant'

export type TrackingSeriesHistoryItem = {
  readonly id: string
  readonly type: string
  readonly event_time: TemporalValueDto | null
  readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  readonly created_at: string
  readonly seriesLabel: SeriesLabel
}

export type TrackingSeriesHistory = {
  readonly hasActualConflict: boolean
  readonly classified: readonly TrackingSeriesHistoryItem[]
}

export type TrackingTimelineItem = {
  readonly id: string
  readonly observationId?: string | null
  readonly type: TrackingObservationProjection['type']
  readonly carrierLabel?: string
  readonly location?: string
  /** Explicit temporal payload coming from obs.event_time. */
  readonly eventTime: TemporalValueDto | null
  /** ACTUAL or EXPECTED */
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  /** Derived state for safe-first rendering */
  readonly derivedState: DerivedObservationState

  /** Optional vessel info (kept raw, UI decides formatting) */
  readonly vesselName?: string | null
  readonly voyage?: string | null

  /** Whether this primary has additional series entries available on demand. */
  readonly hasSeriesHistory?: boolean
  /** Optional series history with backend-derived classification. */
  readonly seriesHistory?: TrackingSeriesHistory
}

function observationToTrackingTimelineItem(
  obs: TrackingObservationProjection,
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
    observationId: obs.id ?? null,
    type: obs.type,
    eventTime: trackingTemporalValueToDto(obs.event_time),
    eventTimeType,
    derivedState,
    hasSeriesHistory: false,
    ...(obs.carrier_label === undefined || obs.carrier_label === null
      ? {}
      : { carrierLabel: obs.carrier_label }),
    ...(location === undefined ? {} : { location }),
    ...(obs.vessel_name === undefined ? {} : { vesselName: obs.vessel_name }),
    ...(obs.voyage === undefined ? {} : { voyage: obs.voyage }),
  }
}

function timelineItemToTrackingItem(
  item: {
    readonly primary: TrackingObservationProjection
    readonly hasSeriesHistory: boolean
    readonly seriesHistory?: TrackingSeriesHistory
  },
  allObservations: readonly TrackingObservationProjection[],
  index: number,
): TrackingTimelineItem {
  const derivedState = deriveObservationState(item.primary, allObservations)
  const base = observationToTrackingTimelineItem(item.primary, index, derivedState)
  return item.seriesHistory === undefined
    ? { ...base, hasSeriesHistory: item.hasSeriesHistory }
    : { ...base, hasSeriesHistory: true, seriesHistory: item.seriesHistory }
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
  observations: readonly TrackingObservationProjection[],
  now: Instant = systemClock.now(),
  options?: { readonly includeSeriesHistory?: boolean },
): TrackingTimelineItem[] {
  if (observations.length === 0) return []

  const groups = new Map<string, TrackingObservationProjection[]>()

  for (const obs of observations) {
    const key = buildSeriesKey(obs)
    const group = groups.get(key)
    if (group) group.push(obs)
    else groups.set(key, [obs])
  }

  const result: Array<{
    primary: TrackingObservationProjection
    hasSeriesHistory: boolean
    seriesHistory?: TrackingSeriesHistory
  }> = []

  for (const series of groups.values()) {
    series.sort(compareObservationsChronologically)
    const classification = classifySeries(series, now)

    if (classification.primary) {
      const shouldIncludeSeriesHistory = options?.includeSeriesHistory ?? true
      const seriesHistory: TrackingSeriesHistory | undefined =
        shouldIncludeSeriesHistory && series.length > 1
          ? {
              hasActualConflict: classification.hasActualConflict,
              classified: classification.classified.map((observation) => ({
                id: observation.id,
                type: observation.type,
                event_time: trackingTemporalValueToDto(observation.event_time),
                event_time_type: observation.event_time_type,
                created_at: observation.created_at,
                seriesLabel: observation.seriesLabel,
              })),
            }
          : undefined

      result.push({
        primary: classification.primary,
        hasSeriesHistory: series.length > 1,
        ...(seriesHistory === undefined ? {} : { seriesHistory }),
      })
    }
  }

  result.sort((a, b) => compareObservationsChronologically(a.primary, b.primary))

  return result.map((item, idx) => timelineItemToTrackingItem(item, observations, idx))
}
