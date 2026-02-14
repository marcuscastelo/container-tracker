import type { Observation } from '~/modules/tracking/domain/observation'
import type { Timeline, TimelineHole } from '~/modules/tracking/domain/timeline'

/**
 * Compute a semantic group key for reconciliation.
 *
 * Groups observations by activity (type), location (location_code),
 * and vessel (vessel_name). Null values are normalized to empty string
 * so that observations missing a field still group together.
 */
function semanticGroupKey(obs: Observation): string {
  const type = obs.type
  const location = (obs.location_code ?? '').toUpperCase().trim()
  const vessel = (obs.vessel_name ?? '').toUpperCase().trim()
  return `${type}|${location}|${vessel}`
}

/**
 * Build a series key for event series grouping.
 *
 * The series key includes:
 * - activity (canonical type)
 * - location_code (fallback: normalized location_display)
 * - vessel_name (nullable)
 * - voyage (nullable)
 *
 * This key determines which observations belong to the same semantic milestone.
 *
 * @param obs - Observation to build key for
 * @returns Deterministic series key string
 */
export function buildSeriesKey(obs: {
  readonly type: string
  readonly location_code: string | null
  readonly location_display: string | null
  readonly vessel_name: string | null
  readonly voyage: string | null
}): string {
  const activity = obs.type
  const location = obs.location_code ?? (obs.location_display ?? '').toUpperCase().trim()
  const vessel = obs.vessel_name ?? ''
  const voyage = obs.voyage ?? ''
  return `${activity}|${location}|${vessel}|${voyage}`
}

/**
 * Compare two observations for chronological ordering.
 *
 * Sort order:
 * 1. event_time ascending (null last)
 * 2. ACTUAL before EXPECTED (when event_time equal)
 * 3. created_at ascending (final tiebreaker)
 *
 * @param a - First observation
 * @param b - Second observation
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
export function compareObservationsChronologically(
  a: {
    readonly event_time: string | null
    readonly event_time_type: 'ACTUAL' | 'EXPECTED'
    readonly created_at: string
  },
  b: {
    readonly event_time: string | null
    readonly event_time_type: 'ACTUAL' | 'EXPECTED'
    readonly created_at: string
  },
): number {
  // Null event_time goes last
  if (a.event_time === null && b.event_time === null) {
    return a.created_at.localeCompare(b.created_at)
  }
  if (a.event_time === null) return 1
  if (b.event_time === null) return -1

  // Compare by event_time
  const timeCmp = a.event_time.localeCompare(b.event_time)
  if (timeCmp !== 0) return timeCmp

  // Equal times: ACTUAL before EXPECTED
  if (a.event_time_type === 'ACTUAL' && b.event_time_type === 'EXPECTED') return -1
  if (a.event_time_type === 'EXPECTED' && b.event_time_type === 'ACTUAL') return 1

  // Final tiebreaker: created_at
  return a.created_at.localeCompare(b.created_at)
}

/**
 * Collapse redundant EXPECTED observations for display purposes.
 *
 * This is a projection-level cleanup — it does NOT modify or delete
 * observations from persistence. It operates on an already-sorted
 * (event_time ascending) list.
 *
 * Rules per semantic group (activity + location + vessel):
 *   1. ACTUAL observations are always kept.
 *   2. If an ACTUAL exists, remove all EXPECTED that are older
 *      (event_time <= ACTUAL event_time).
 *   3. If an ACTUAL exists before a future EXPECTED, keep both
 *      (future EXPECTED represents a new plan).
 *   4. If multiple EXPECTED exist without a covering ACTUAL,
 *      keep only the most recent non-expired one.
 *   5. Expired EXPECTED (event_time < now) without a covering ACTUAL
 *      are removed.
 *
 * @param sorted - Observations sorted by event_time ascending (nulls last)
 * @param now - Reference time for expiration check (defaults to current time)
 * @returns Filtered observations preserving original sort order
 */
export function reconcileForDisplay(
  sorted: readonly Observation[],
  now: Date = new Date(),
): Observation[] {
  // Group observations by semantic identity
  const groups = new Map<string, Observation[]>()
  for (const obs of sorted) {
    const key = semanticGroupKey(obs)
    const group = groups.get(key)
    if (group) {
      group.push(obs)
    } else {
      groups.set(key, [obs])
    }
  }

  // Determine which observations to exclude
  const excludeIds = new Set<string>()

  for (const group of groups.values()) {
    const actuals = group.filter((o) => o.event_time_type === 'ACTUAL')
    const expecteds = group.filter((o) => o.event_time_type === 'EXPECTED')

    if (expecteds.length === 0) continue

    // Find the latest ACTUAL event_time in this group (may be undefined)
    const latestActualTime =
      actuals.length > 0
        ? actuals.reduce<string | null>((latest, a) => {
            if (a.event_time === null) return latest
            if (latest === null) return a.event_time
            return a.event_time > latest ? a.event_time : latest
          }, null)
        : null

    // Partition EXPECTED into those covered by an ACTUAL and those not
    const coveredByActual: Observation[] = []
    const notCoveredByActual: Observation[] = []
    for (const exp of expecteds) {
      if (
        latestActualTime !== null &&
        exp.event_time !== null &&
        exp.event_time <= latestActualTime
      ) {
        coveredByActual.push(exp)
      } else {
        notCoveredByActual.push(exp)
      }
    }

    // Rule 2: Remove all EXPECTED older than the latest ACTUAL
    for (const exp of coveredByActual) {
      excludeIds.add(exp.id)
    }

    // For remaining EXPECTED (not covered by ACTUAL):
    // Separate into expired and active
    const nowIso = now.toISOString()
    const expired: Observation[] = []
    const active: Observation[] = []
    for (const exp of notCoveredByActual) {
      if (exp.event_time !== null && exp.event_time < nowIso) {
        expired.push(exp)
      } else {
        active.push(exp)
      }
    }

    // Rule 5: Expired EXPECTED without a covering ACTUAL are removed
    for (const exp of expired) {
      excludeIds.add(exp.id)
    }

    // Rule 4: Among active EXPECTED, keep only the most recent
    if (active.length > 1) {
      // Already sorted ascending by event_time, so last is most recent.
      // For null event_times (placed last in sort), keep the last one.
      const kept = active[active.length - 1]
      for (const exp of active) {
        if (exp.id !== kept?.id) {
          excludeIds.add(exp.id)
        }
      }
    }
  }

  return sorted.filter((obs) => !excludeIds.has(obs.id))
}

/**
 * Derive a Timeline from a set of observations for a single container.
 *
 * Timeline rules:
 *   - Ordered by event_time ascending (nulls last)
 *   - For equal event_time, ACTUAL observations come before EXPECTED (visual precedence)
 *   - For ties in both, use created_at as final tiebreaker
 *   - Cycles are allowed (transshipment: LOAD → DISCHARGE → LOAD)
 *   - Holes are detected when there's a gap > 14 days between consecutive events
 *   - Redundant EXPECTED observations are collapsed for display
 *   - Timeline is NOT persisted — it's a runtime projection
 *
 * @param containerId - UUID of the container
 * @param containerNumber - Container number (denormalized)
 * @param observations - All persisted observations for this container
 * @param now - Reference time for reconciliation (defaults to current time)
 * @returns Timeline
 *
 * @see docs/master-consolidated-0209.md §2.5
 * @see Issue: Canonical differentiation between ACTUAL vs EXPECTED
 * @see Issue: Visual Reconciliation Layer (Non-Persistent)
 */
export function deriveTimeline(
  containerId: string,
  containerNumber: string,
  observations: readonly Observation[],
  now: Date = new Date(),
): Timeline {
  // Sort: event_time ascending, nulls last.
  // For equal times: ACTUAL before EXPECTED (visual precedence).
  // For ties: use created_at.
  const sorted = [...observations].sort((a, b) => {
    if (a.event_time === null && b.event_time === null) {
      return a.created_at.localeCompare(b.created_at)
    }
    if (a.event_time === null) return 1
    if (b.event_time === null) return -1
    const cmp = a.event_time.localeCompare(b.event_time)
    if (cmp !== 0) return cmp

    // Times are equal — ACTUAL comes before EXPECTED
    if (a.event_time_type === 'ACTUAL' && b.event_time_type === 'EXPECTED') return -1
    if (a.event_time_type === 'EXPECTED' && b.event_time_type === 'ACTUAL') return 1

    // Both are ACTUAL or both are EXPECTED — use created_at
    return a.created_at.localeCompare(b.created_at)
  })

  // Reconcile: collapse redundant EXPECTED observations for display
  const reconciled = reconcileForDisplay(sorted, now)

  // Detect holes: gaps > 14 days between consecutive events
  const holes: TimelineHole[] = []
  const GAP_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000

  for (let i = 1; i < reconciled.length; i++) {
    const prev = reconciled[i - 1]
    const curr = reconciled[i]
    if (prev?.event_time && curr?.event_time) {
      const prevTime = new Date(prev.event_time).getTime()
      const currTime = new Date(curr.event_time).getTime()
      if (currTime - prevTime > GAP_THRESHOLD_MS) {
        holes.push({
          from: prev.event_time,
          to: curr.event_time,
          reason: 'gap',
        })
      }
    }
  }

  // Check for missing data at the beginning
  if (reconciled.length === 0) {
    holes.push({
      from: null,
      to: null,
      reason: 'missing_data',
    })
  }

  return {
    container_id: containerId,
    container_number: containerNumber,
    observations: reconciled,
    derived_at: new Date().toISOString(),
    holes,
  }
}
