import type { ContainerStatus } from '~/modules/tracking/domain/model/containerStatus'
import type { ObservationType } from '~/modules/tracking/domain/model/observationType'
import type { Timeline } from '~/modules/tracking/domain/model/timeline'

/**
 * Maps observation types to the status they imply.
 */
const OBSERVATION_TO_STATUS: Partial<Record<ObservationType, ContainerStatus>> = {
  GATE_IN: 'IN_PROGRESS',
  GATE_OUT: 'IN_PROGRESS',
  LOAD: 'LOADED',
  DEPARTURE: 'IN_TRANSIT',
  ARRIVAL: 'ARRIVED_AT_POD',
  DISCHARGE: 'DISCHARGED',
  DELIVERY: 'DELIVERED',
  EMPTY_RETURN: 'EMPTY_RETURNED',
  CUSTOMS_HOLD: 'DISCHARGED', // Customs hold implies already discharged
  CUSTOMS_RELEASE: 'DISCHARGED',
}

/**
 * Derive the current status of a container from its timeline.
 *
 * Status follows the most recent operational ACTUAL fact.
 * EXPECTED observations are informational and never advance status.
 *
 * Timeline is already sorted ascending by `deriveTimeline` (event_time asc,
 * ACTUAL before EXPECTED for equal times), so scanning from the end gives us
 * the latest observed ACTUAL first.
 *
 * @param timeline - Derived timeline for the container
 * @returns The status derived from latest relevant ACTUAL observation
 */
export function deriveStatus(timeline: Timeline): ContainerStatus {
  for (let i = timeline.observations.length - 1; i >= 0; i--) {
    const observation = timeline.observations[i]
    if (observation?.event_time_type !== 'ACTUAL') continue

    const mapped = OBSERVATION_TO_STATUS[observation.type]
    if (mapped) return mapped
  }

  // No recognizable ACTUAL yet, but timeline has activity.
  if (timeline.observations.length > 0) return 'IN_PROGRESS'

  return 'UNKNOWN'
}
