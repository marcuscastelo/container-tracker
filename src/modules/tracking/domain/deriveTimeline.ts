import type { Observation } from '~/modules/tracking/domain/observation'
import type { Timeline, TimelineHole, TimelineItem } from '~/modules/tracking/domain/timeline'

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
function buildSeriesKey(obs: Observation): string {
  const activity = obs.type
  const location =
    obs.location_code ?? (obs.location_display ?? '').toUpperCase().trim()
  const vessel = obs.vessel_name ?? ''
  const voyage = obs.voyage ?? ''
  return `${activity}|${location}|${vessel}|${voyage}`
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
 * Derive timeline items with event series grouping.
 *
 * This function collapses multiple EXPECTED updates of the same semantic event
 * into a single visible timeline entry, while preserving full prediction history.
 *
 * Rules per series key:
 *   1. If an ACTUAL exists: primary = most recent ACTUAL, series = all obs for that key
 *   2. If only EXPECTED exist: primary = most recent non-expired EXPECTED
 *   3. Expired EXPECTED must NOT become primary (but remain in series history)
 *   4. Multiple EXPECTED updates: only latest appears as primary
 *
 * This is a projection-level enhancement that does NOT modify persistence.
 *
 * @param sorted - Observations already sorted by event_time ascending
 * @param now - Reference time for expiration check (defaults to current time)
 * @returns Array of TimelineItem (events with optional series history)
 */
export function deriveTimelineSeries(
  sorted: readonly Observation[],
  now: Date = new Date(),
): TimelineItem[] {
  // Group observations by series key
  const groups = new Map<string, Observation[]>()

  for (const obs of sorted) {
    const key = buildSeriesKey(obs)
    const group = groups.get(key)
    if (group) {
      group.push(obs)
    } else {
      groups.set(key, [obs])
    }
  }

  const result: TimelineItem[] = []
  const nowIso = now.toISOString()

  for (const series of groups.values()) {
    // Separate ACTUAL and EXPECTED observations
    const actuals = series.filter((o) => o.event_time_type === 'ACTUAL')
    const expecteds = series.filter((o) => o.event_time_type === 'EXPECTED')

    let primary: Observation | null = null

    if (actuals.length > 0) {
      // Rule 1: If ACTUAL exists, use the most recent one
      primary = actuals[actuals.length - 1] ?? null
    } else if (expecteds.length > 0) {
      // Rule 2: Use most recent non-expired EXPECTED
      // Filter out expired EXPECTED (event_time < now)
      const activeExpecteds = expecteds.filter((exp) => {
        if (exp.event_time === null) return true // null event_time is considered active
        return exp.event_time >= nowIso
      })

      if (activeExpecteds.length > 0) {
        primary = activeExpecteds[activeExpecteds.length - 1] ?? null
      }
      // If all EXPECTED are expired, primary remains null (won't be shown)
    }

    if (primary) {
      result.push({
        kind: 'event',
        primary,
        // Only attach series if there are multiple observations
        series: series.length > 1 ? series : undefined,
      })
    }
  }

  // Sort result chronologically by primary event_time
  return result.sort((a, b) => {
    if (a.kind !== 'event' || b.kind !== 'event') return 0

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
    if (a.primary.event_time_type === 'EXPECTED' && b.primary.event_time_type === 'ACTUAL')
      return 1

    // Final tiebreaker: created_at
    return a.primary.created_at.localeCompare(b.primary.created_at)
  })
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
