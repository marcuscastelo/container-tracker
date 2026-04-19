import {
  compareTrackingTemporalValues,
  isTrackingTemporalValueExpired,
} from '~/modules/tracking/domain/temporal/tracking-temporal'
import { systemClock } from '~/shared/time/clock'
import type { Instant } from '~/shared/time/instant'
import type { TemporalValue } from '~/shared/time/temporal-value'

/**
 * Event Series Classification (Projection-Only)
 *
 * Classifies observations within an event series for UI rendering, including:
 * - Redundant EXPECTED entries that occur after ACTUAL confirmation
 * - Conflicting ACTUAL entries (safe-first primary selection)
 * - Superseded EXPECTED entries
 * - Active/Expired/Confirmed states
 *
 * This is a projection-level enhancement that does NOT modify persistence.
 *
 * @see Addendum Spec — Event Series Classification: Redundant EXPECTED + Conflicting ACTUAL
 */

/**
 * Derived label for each observation within a series.
 *
 * These labels are runtime-only and represent the operational state
 * of each entry in the prediction history.
 */
export type SeriesLabel =
  | 'ACTIVE' // Current primary forecast (latest observed EXPECTED while valid) OR chosen primary ACTUAL
  | 'EXPIRED' // EXPECTED in the past with no ACTUAL after it
  | 'REDUNDANT_AFTER_ACTUAL' // EXPECTED whose event_time >= lastActualTime (invalid)
  | 'SUPERSEDED_EXPECTED' // Older EXPECTED replaced by a newer EXPECTED
  | 'CONFIRMED' // ACTUAL selected as confirmation (primary)
  | 'CONFLICTING_ACTUAL' // Additional ACTUAL events beyond primary

export type TrackingSeriesConflictKind =
  | 'MULTIPLE_ACTUALS'
  | 'VOYAGE_MISMATCH_AFTER_ACTUAL_CONFIRMATION'

export type TrackingSeriesConflictField = 'voyage'

export type TrackingSeriesConflict = {
  readonly kind: TrackingSeriesConflictKind
  readonly fields: readonly TrackingSeriesConflictField[]
}

export type TrackingSeriesHistoryChangeKind = 'VOYAGE_CORRECTED_AFTER_CONFIRMATION'

/**
 * Minimal shape required for series classification.
 */
export type ObservationLike = {
  readonly event_time: TemporalValue | null
  readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  readonly created_at: string
  readonly voyage?: string | null
}

/**
 * Classified observation with derived series label.
 */
export type ClassifiedObservation<T extends ObservationLike = ObservationLike> = T & {
  readonly seriesLabel: SeriesLabel
  readonly changeKind: TrackingSeriesHistoryChangeKind | null
}

/**
 * Result of series classification analysis.
 */
type SeriesClassification<T extends ObservationLike = ObservationLike> = {
  /** Primary observation to display in main timeline */
  readonly primary: T | null
  /** All observations with derived labels */
  readonly classified: readonly ClassifiedObservation<T>[]
  /** Whether series contains multiple ACTUAL entries (conflict detected) */
  readonly hasActualConflict: boolean
  /** Number of conflicting ACTUAL entries (if any) */
  readonly conflictingActualCount: number
  /** Structured conflict metadata when the series is conflicted */
  readonly conflict: TrackingSeriesConflict | null
}

function normalizeVoyage(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? ''
  return normalized.length > 0 ? normalized : null
}

function resolveConflict(
  actuals: readonly ObservationLike[],
  hasActualConflict: boolean,
): TrackingSeriesConflict | null {
  if (!hasActualConflict) return null

  const voyages = new Set<string>()
  for (const actual of actuals) {
    const voyage = normalizeVoyage(actual.voyage)
    if (voyage !== null) {
      voyages.add(voyage)
    }
  }

  if (voyages.size >= 2) {
    return {
      kind: 'VOYAGE_MISMATCH_AFTER_ACTUAL_CONFIRMATION',
      fields: ['voyage'],
    }
  }

  return {
    kind: 'MULTIPLE_ACTUALS',
    fields: [],
  }
}

export function compareSeriesObservationsByObservedAt(
  left: ObservationLike,
  right: ObservationLike,
): number {
  return left.created_at.localeCompare(right.created_at)
}

function compareActualObservationsForPrimarySelection(
  left: ObservationLike,
  right: ObservationLike,
): number {
  const observedAtCompare = compareSeriesObservationsByObservedAt(left, right)
  if (observedAtCompare !== 0) return observedAtCompare

  if (left.event_time === null && right.event_time !== null) return -1
  if (left.event_time !== null && right.event_time === null) return 1

  return compareTrackingTemporalValues(left.event_time, right.event_time)
}

export function pickLatestObservedExpected<T extends ObservationLike>(
  series: readonly T[],
): T | null {
  let latest: T | null = null

  for (const observation of series) {
    if (observation.event_time_type !== 'EXPECTED') continue
    if (latest === null || compareSeriesObservationsByObservedAt(observation, latest) >= 0) {
      latest = observation
    }
  }

  return latest
}

/**
 * Classify a series of observations with derived labels.
 *
 * This function implements the safe-first classification rules:
 * 1. Detects EXPECTED entries after ACTUAL (redundant/invalid)
 * 2. Detects multiple ACTUAL entries (conflict)
 * 3. Selects safe-first primary (latest observed ACTUAL, or latest observed EXPECTED while valid)
 * 4. Assigns appropriate labels to all observations
 *
 * @param series - Array of observations in the same series (same semantic milestone)
 * @param now - Reference time for expiration check (defaults to current time)
 * @returns SeriesClassification with primary, classified list, and conflict metadata
 */
export function classifySeries<T extends ObservationLike>(
  series: readonly T[],
  now: Instant = systemClock.now(),
): SeriesClassification<T> {
  if (series.length === 0) {
    return {
      primary: null,
      classified: [],
      hasActualConflict: false,
      conflictingActualCount: 0,
      conflict: null,
    }
  }

  // Separate ACTUAL and EXPECTED observations
  const actuals = series.filter((o) => o.event_time_type === 'ACTUAL')

  // Detect conflict: multiple ACTUAL entries
  const hasActualConflict = actuals.length >= 2
  const conflictingActualCount = hasActualConflict ? actuals.length - 1 : 0
  const conflict = resolveConflict(actuals, hasActualConflict)

  // Safe-first primary selection
  // For ACTUAL conflicts, primary means latest observed carrier revision.
  let primaryActual: T | null = null
  if (actuals.length > 0) {
    primaryActual = actuals.reduce((latest, current) =>
      compareActualObservationsForPrimarySelection(current, latest) > 0 ? current : latest,
    )
  }

  const lastActualTime = primaryActual?.event_time ?? null
  const primaryActualVoyage = normalizeVoyage(primaryActual?.voyage)
  const latestObservedExpected = pickLatestObservedExpected(series)

  // Classify all observations
  const classified: ClassifiedObservation<T>[] = series.map((obs) => {
    // ACTUAL classification
    if (obs.event_time_type === 'ACTUAL') {
      if (obs === primaryActual) {
        // Primary ACTUAL is both CONFIRMED and ACTIVE
        return {
          ...obs,
          seriesLabel: 'CONFIRMED' as const,
          changeKind: null,
        }
      }
      // Non-primary ACTUAL is conflicting
      const conflictingVoyage = normalizeVoyage(obs.voyage)
      const changeKind =
        conflict?.kind === 'VOYAGE_MISMATCH_AFTER_ACTUAL_CONFIRMATION' &&
        primaryActualVoyage !== null &&
        conflictingVoyage !== null &&
        conflictingVoyage !== primaryActualVoyage
          ? 'VOYAGE_CORRECTED_AFTER_CONFIRMATION'
          : null

      return {
        ...obs,
        seriesLabel: 'CONFLICTING_ACTUAL' as const,
        changeKind,
      }
    }

    // EXPECTED classification
    // Rule E1: EXPECTED after ACTUAL is invalid/redundant
    if (
      lastActualTime !== null &&
      obs.event_time !== null &&
      compareTrackingTemporalValues(obs.event_time, lastActualTime) >= 0
    ) {
      return {
        ...obs,
        seriesLabel: 'REDUNDANT_AFTER_ACTUAL' as const,
        changeKind: null,
      }
    }

    const isExpired = isTrackingTemporalValueExpired(obs.event_time, now)

    // Rule E2: EXPECTED before ACTUAL is superseded by confirmation.
    if (
      lastActualTime !== null &&
      obs.event_time !== null &&
      compareTrackingTemporalValues(obs.event_time, lastActualTime) < 0
    ) {
      return {
        ...obs,
        seriesLabel: 'SUPERSEDED_EXPECTED' as const,
        changeKind: null,
      }
    }

    // Without ACTUAL, carrier revision recency wins over predicted event date.
    if (lastActualTime === null && obs === latestObservedExpected) {
      return {
        ...obs,
        seriesLabel: isExpired ? ('EXPIRED' as const) : ('ACTIVE' as const),
        changeKind: null,
      }
    }

    // Older EXPECTED revisions are superseded by the newest observed revision.
    return {
      ...obs,
      seriesLabel: 'SUPERSEDED_EXPECTED' as const,
      changeKind: null,
    }
  })

  // Determine primary for main timeline
  let primary: T | null = null
  if (primaryActual) {
    // Rule: If any ACTUAL exists, primary = latest observed ACTUAL.
    primary = primaryActual
  } else {
    // Rule: Use latest observed EXPECTED only while it is still active.
    if (
      latestObservedExpected !== null &&
      !isTrackingTemporalValueExpired(latestObservedExpected.event_time, now)
    ) {
      primary = latestObservedExpected
    }
  }

  return {
    primary,
    classified,
    hasActualConflict,
    conflictingActualCount,
    conflict,
  }
}
