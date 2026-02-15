/**
 * Derived observation state — runtime-only classification for timeline rendering.
 *
 * - ACTUAL: Confirmed event (event_time_type === 'ACTUAL')
 * - ACTIVE_EXPECTED: Future prediction still valid (event_time >= now, no ACTUAL equivalent)
 * - EXPIRED_EXPECTED: Prediction whose planned time has passed without confirmation
 *
 * This is a projection-level concept — it does NOT modify observations.
 *
 * @see Issue: Introduce Canonical Concept "Expired Expected"
 */
export type DerivedObservationState = 'ACTUAL' | 'ACTIVE_EXPECTED' | 'EXPIRED_EXPECTED'

/**
 * Minimal shape required for expired-expected detection.
 * Both domain Observation and API ObservationResponse satisfy this.
 */
type ObservationLike = {
  readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  readonly event_time: string | null
  readonly type: string
  readonly location_code: string | null
  readonly vessel_name: string | null
}

/**
 * Determines whether two observations are semantically equivalent.
 *
 * Equivalence is defined by:
 *   - Same activity semantic type (ObservationType)
 *   - Same location (if both have location_code)
 *   - Same vessel/voyage (if both have vessel_name)
 *
 * This is used to check if an ACTUAL observation "covers" an EXPECTED one.
 */
function isSemanticEquivalent(a: ObservationLike, b: ObservationLike): boolean {
  if (a.type !== b.type) return false

  // Location check: if both have location_code, they must match
  if (a.location_code !== null && b.location_code !== null && a.location_code !== b.location_code) {
    return false
  }

  // Vessel check: if both have vessel_name, they must match
  if (a.vessel_name !== null && b.vessel_name !== null && a.vessel_name !== b.vessel_name) {
    return false
  }

  return true
}

/**
 * Check if an EXPECTED observation is expired.
 *
 * An observation is ExpiredExpected if:
 *   1. event_time_type === 'EXPECTED'
 *   2. event_time < now (the planned time has passed)
 *   3. No semantically equivalent ACTUAL observation exists
 *
 * @param observation - The observation to evaluate
 * @param allObservations - All observations for the same container
 * @param now - Reference time for expiration check (defaults to current time)
 * @returns true if the observation is an expired expected event
 */
export function isExpiredExpected(
  observation: ObservationLike,
  allObservations: readonly ObservationLike[],
  now: Date = new Date(),
): boolean {
  // Only EXPECTED observations can be expired
  if (observation.event_time_type !== 'EXPECTED') return false

  // Must have an event_time to determine expiration
  if (observation.event_time === null) return false

  // Event time must be in the past
  const eventTime = new Date(observation.event_time)
  if (eventTime >= now) return false

  // Check if any ACTUAL equivalent exists
  const hasActualEquivalent = allObservations.some(
    (other) => other.event_time_type === 'ACTUAL' && isSemanticEquivalent(observation, other),
  )

  return !hasActualEquivalent
}

/**
 * Derive the observation state for timeline rendering.
 *
 * @param observation - The observation to classify
 * @param allObservations - All observations for the same container
 * @param now - Reference time for expiration check (defaults to current time)
 * @returns The derived state for this observation
 */
export function deriveObservationState(
  observation: ObservationLike,
  allObservations: readonly ObservationLike[],
  now: Date = new Date(),
): DerivedObservationState {
  if (observation.event_time_type === 'ACTUAL') return 'ACTUAL'
  if (isExpiredExpected(observation, allObservations, now)) return 'EXPIRED_EXPECTED'
  return 'ACTIVE_EXPECTED'
}
