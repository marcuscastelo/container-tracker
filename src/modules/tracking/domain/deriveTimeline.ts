import type { Observation } from '~/modules/tracking/domain/observation'
import type { Timeline, TimelineHole } from '~/modules/tracking/domain/timeline'

/**
 * Derive a Timeline from a set of observations for a single container.
 *
 * Timeline rules:
 *   - Ordered by event_time ascending (nulls last)
 *   - For equal event_time, ACTUAL observations come before EXPECTED (visual precedence)
 *   - For ties in both, use created_at as final tiebreaker
 *   - Cycles are allowed (transshipment: LOAD → DISCHARGE → LOAD)
 *   - Holes are detected when there's a gap > 14 days between consecutive events
 *   - Timeline is NOT persisted — it's a runtime projection
 *
 * @param containerId - UUID of the container
 * @param containerNumber - Container number (denormalized)
 * @param observations - All persisted observations for this container
 * @returns Timeline
 *
 * @see docs/master-consolidated-0209.md §2.5
 * @see Issue: Canonical differentiation between ACTUAL vs EXPECTED
 */
export function deriveTimeline(
  containerId: string,
  containerNumber: string,
  observations: readonly Observation[],
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

  // Detect holes: gaps > 14 days between consecutive events
  const holes: TimelineHole[] = []
  const GAP_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
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
  if (sorted.length === 0) {
    holes.push({
      from: null,
      to: null,
      reason: 'missing_data',
    })
  }

  return {
    container_id: containerId,
    container_number: containerNumber,
    observations: sorted,
    derived_at: new Date().toISOString(),
    holes,
  }
}
