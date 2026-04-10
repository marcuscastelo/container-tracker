import { resolveLocationDisplay } from '~/modules/tracking/application/projection/locationDisplayResolver'
import { applyVoyageExpectedSubstitution } from '~/modules/tracking/application/projection/voyageExpectedSubstitution.readmodel'
import { trackingTemporalValueToDto } from '~/modules/tracking/domain/temporal/tracking-temporal'
import type { TrackingObservationProjection } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import {
  buildCanonicalSeriesGroups,
  type CanonicalSeriesGroup,
} from '~/modules/tracking/features/series/domain/reconcile/canonicalSeries'
import {
  type DerivedObservationState,
  deriveObservationState,
} from '~/modules/tracking/features/series/domain/reconcile/expiredExpected'
import {
  type ClassifiedObservation,
  classifySeries,
  type SeriesLabel,
  type TrackingSeriesConflict,
  type TrackingSeriesHistoryChangeKind,
} from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
import { compareObservationsChronologically } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
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
  readonly vesselName?: string | null
  readonly voyage?: string | null
  readonly changeKind?: TrackingSeriesHistoryChangeKind | null
}

export type TrackingSeriesHistory = {
  readonly hasActualConflict: boolean
  readonly conflict?: TrackingSeriesConflict | null
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
  /** Structured conflict metadata for the canonical series. */
  readonly seriesConflict?: TrackingSeriesConflict | null
  /** Optional series history with backend-derived classification. */
  readonly seriesHistory?: TrackingSeriesHistory
}

type TimelineSeriesCandidate = {
  readonly primary: TrackingObservationProjection
  readonly classified: readonly ClassifiedObservation<TrackingObservationProjection>[]
  readonly hasActualConflict: boolean
  readonly conflict: TrackingSeriesConflict | null
}

function observationToTrackingTimelineItem(
  obs: TrackingObservationProjection,
  index: number,
  seriesConflict: TrackingSeriesConflict | null,
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
    ...(seriesConflict === null ? {} : { seriesConflict }),
  }
}

function timelineItemToTrackingItem(
  item: {
    readonly primary: TrackingObservationProjection
    readonly seriesConflict: TrackingSeriesConflict | null
    readonly hasSeriesHistory: boolean
    readonly seriesHistory?: TrackingSeriesHistory
  },
  allObservations: readonly TrackingObservationProjection[],
  index: number,
): TrackingTimelineItem {
  const derivedState = deriveObservationState(item.primary, allObservations)
  const base = observationToTrackingTimelineItem(
    item.primary,
    index,
    item.seriesConflict,
    derivedState,
  )
  return item.seriesHistory === undefined
    ? { ...base, hasSeriesHistory: item.hasSeriesHistory }
    : { ...base, hasSeriesHistory: true, seriesHistory: item.seriesHistory }
}

function toTrackingSeriesHistoryItem(
  observation: ClassifiedObservation<TrackingObservationProjection>,
): TrackingSeriesHistoryItem {
  return {
    id: observation.id,
    type: observation.type,
    event_time: trackingTemporalValueToDto(observation.event_time),
    event_time_type: observation.event_time_type,
    created_at: observation.created_at,
    seriesLabel: observation.seriesLabel,
    ...(observation.vessel_name === undefined ? {} : { vesselName: observation.vessel_name }),
    ...(observation.voyage === undefined ? {} : { voyage: observation.voyage }),
    changeKind: observation.changeKind,
  }
}

function sortClassifiedTimelineHistory(
  classified: readonly ClassifiedObservation<TrackingObservationProjection>[],
): readonly ClassifiedObservation<TrackingObservationProjection>[] {
  if (classified.length < 2) return classified
  return [...classified].sort(compareObservationsChronologically)
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

  const result: Array<{
    primary: TrackingObservationProjection
    seriesConflict: TrackingSeriesConflict | null
    hasSeriesHistory: boolean
    seriesHistory?: TrackingSeriesHistory
  }> = []
  const seriesCandidates: TimelineSeriesCandidate[] = []

  const canonicalSeriesGroups: readonly CanonicalSeriesGroup<TrackingObservationProjection>[] =
    buildCanonicalSeriesGroups(observations, now)

  for (const canonicalSeries of canonicalSeriesGroups) {
    const classification = classifySeries(canonicalSeries.observations, now)

    if (classification.primary) {
      seriesCandidates.push({
        primary: classification.primary,
        classified: classification.classified,
        hasActualConflict: classification.hasActualConflict,
        conflict: classification.conflict,
      })
    }
  }

  const shouldIncludeSeriesHistory = options?.includeSeriesHistory ?? true
  const substitution = applyVoyageExpectedSubstitution(seriesCandidates)

  for (const candidate of substitution.visibleCandidates) {
    const mergedSuppressedHistory =
      substitution.mergedSuppressedHistoryByPrimaryId.get(candidate.primary.id) ?? []
    const combinedClassified = sortClassifiedTimelineHistory([
      ...candidate.classified,
      ...mergedSuppressedHistory,
    ])
    const hasSeriesHistory = combinedClassified.length > 1
    const seriesHistory: TrackingSeriesHistory | undefined =
      shouldIncludeSeriesHistory && hasSeriesHistory
        ? {
            hasActualConflict: candidate.hasActualConflict,
            ...(candidate.conflict === null ? {} : { conflict: candidate.conflict }),
            classified: combinedClassified.map(toTrackingSeriesHistoryItem),
          }
        : undefined

    result.push({
      primary: candidate.primary,
      seriesConflict: candidate.conflict,
      hasSeriesHistory,
      ...(seriesHistory === undefined ? {} : { seriesHistory }),
    })
  }

  result.sort((a, b) => compareObservationsChronologically(a.primary, b.primary))

  return result.map((item, idx) => timelineItemToTrackingItem(item, observations, idx))
}
