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
  | 'ACTIVE' // Current primary forecast (latest valid EXPECTED) OR chosen primary ACTUAL
  | 'EXPIRED' // EXPECTED in the past with no ACTUAL after it
  | 'REDUNDANT_AFTER_ACTUAL' // EXPECTED whose event_time >= lastActualTime (invalid)
  | 'SUPERSEDED_EXPECTED' // Older EXPECTED replaced by a newer EXPECTED
  | 'CONFIRMED' // ACTUAL selected as confirmation (primary)
  | 'CONFLICTING_ACTUAL' // Additional ACTUAL events beyond primary

/**
 * Minimal shape required for series classification.
 */
export type ObservationLike = {
  readonly event_time: TemporalValue | null
  readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  readonly created_at: string
}

/**
 * Classified observation with derived series label.
 */
export type ClassifiedObservation<T extends ObservationLike = ObservationLike> = T & {
  readonly seriesLabel: SeriesLabel
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
}

/**
 * Classify a series of observations with derived labels.
 *
 * This function implements the safe-first classification rules:
 * 1. Detects EXPECTED entries after ACTUAL (redundant/invalid)
 * 2. Detects multiple ACTUAL entries (conflict)
 * 3. Selects safe-first primary (latest ACTUAL, or latest valid EXPECTED)
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
    }
  }

  // Separate ACTUAL and EXPECTED observations
  const actuals = series.filter((o) => o.event_time_type === 'ACTUAL')
  const expecteds = series.filter((o) => o.event_time_type === 'EXPECTED')

  // Detect conflict: multiple ACTUAL entries
  const hasActualConflict = actuals.length >= 2
  const conflictingActualCount = hasActualConflict ? actuals.length - 1 : 0

  // Safe-first primary selection
  let primaryActual: T | null = null
  if (actuals.length > 0) {
    primaryActual = actuals.reduce((latest, current) => {
      if (current.event_time === null && latest.event_time !== null) return latest
      if (current.event_time !== null && latest.event_time === null) return current
      const eventTimeCompare = compareTrackingTemporalValues(current.event_time, latest.event_time)
      if (eventTimeCompare > 0) return current
      if (eventTimeCompare < 0) return latest
      return current.created_at > latest.created_at ? current : latest
    })
  }

  const lastActualTime = primaryActual?.event_time ?? null

  // Classify all observations
  const classified: ClassifiedObservation<T>[] = series.map((obs) => {
    // ACTUAL classification
    if (obs.event_time_type === 'ACTUAL') {
      if (obs === primaryActual) {
        // Primary ACTUAL is both CONFIRMED and ACTIVE
        return { ...obs, seriesLabel: 'CONFIRMED' as const }
      }
      // Non-primary ACTUAL is conflicting
      return { ...obs, seriesLabel: 'CONFLICTING_ACTUAL' as const }
    }

    // EXPECTED classification
    // Rule E1: EXPECTED after ACTUAL is invalid/redundant
    if (
      lastActualTime !== null &&
      obs.event_time !== null &&
      compareTrackingTemporalValues(obs.event_time, lastActualTime) >= 0
    ) {
      return { ...obs, seriesLabel: 'REDUNDANT_AFTER_ACTUAL' as const }
    }

    const isExpired = isTrackingTemporalValueExpired(obs.event_time, now)

    // Rule E2: EXPECTED before ACTUAL (but not the latest EXPECTED)
    if (
      lastActualTime !== null &&
      obs.event_time !== null &&
      compareTrackingTemporalValues(obs.event_time, lastActualTime) < 0
    ) {
      return { ...obs, seriesLabel: 'SUPERSEDED_EXPECTED' as const }
    }

    // Among remaining EXPECTED (no ACTUAL yet, or future EXPECTED after ACTUAL):
    // Determine if this is the active forecast
    const activeExpecteds = expecteds.filter((exp) => {
      // Exclude redundant EXPECTED (after ACTUAL)
      if (
        lastActualTime !== null &&
        exp.event_time !== null &&
        compareTrackingTemporalValues(exp.event_time, lastActualTime) >= 0
      ) {
        return false
      }
      // Exclude expired
      if (isTrackingTemporalValueExpired(exp.event_time, now)) {
        return false
      }
      return true
    })

    // Latest active EXPECTED is ACTIVE
    const latestActiveExpected =
      activeExpecteds.length > 0 ? activeExpecteds[activeExpecteds.length - 1] : null

    if (obs === latestActiveExpected) {
      return { ...obs, seriesLabel: 'ACTIVE' as const }
    }

    // If there is an active EXPECTED, older ones are SUPERSEDED (not EXPIRED)
    if (latestActiveExpected !== null) {
      return { ...obs, seriesLabel: 'SUPERSEDED_EXPECTED' as const }
    }

    // Expired EXPECTED (no ACTUAL to supersede it, and no active EXPECTED)
    if (isExpired) {
      return { ...obs, seriesLabel: 'EXPIRED' as const }
    }

    // Older EXPECTED superseded by newer EXPECTED
    return { ...obs, seriesLabel: 'SUPERSEDED_EXPECTED' as const }
  })

  // Determine primary for main timeline
  let primary: T | null = null
  if (primaryActual) {
    // Rule: If any ACTUAL exists, primary = primaryActual (latest)
    primary = primaryActual
  } else {
    // Rule: Use latest valid (non-expired, non-redundant) EXPECTED
    const validExpecteds = classified.filter(
      (c) =>
        c.event_time_type === 'EXPECTED' &&
        c.seriesLabel !== 'EXPIRED' &&
        c.seriesLabel !== 'REDUNDANT_AFTER_ACTUAL',
    )
    if (validExpecteds.length > 0) {
      primary = validExpecteds[validExpecteds.length - 1] ?? null
    }
  }

  return {
    primary,
    classified,
    hasActualConflict,
    conflictingActualCount,
  }
}
