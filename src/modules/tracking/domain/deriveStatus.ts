import type { ContainerStatus } from '~/modules/tracking/domain/containerStatus'
import { statusDominanceIndex } from '~/modules/tracking/domain/containerStatus'
import type { ObservationType } from '~/modules/tracking/domain/observationType'
import type { Timeline } from '~/modules/tracking/domain/timeline'

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
 * Status is a MONOTONIC projection — it never regresses.
 * The algorithm finds the highest-dominance status implied by any
 * **ACTUAL** observation in the timeline.
 *
 * CRITICAL RULE: Only ACTUAL observations can advance status.
 * EXPECTED observations are informational only and do NOT affect status.
 *
 * Pseudocode from master doc:
 *   if delivered (ACTUAL) → DELIVERED
 *   else if discharged_at_final (ACTUAL) → DISCHARGED
 *   else if arrived_at_final (ACTUAL) → ARRIVED_AT_POD
 *   else if any_departure (ACTUAL) → IN_TRANSIT
 *   else if any_load (ACTUAL) → LOADED
 *   else → IN_PROGRESS
 *
 * @param timeline - Derived timeline for the container
 * @returns The highest-dominance status
 *
 * @see docs/master-consolidated-0209.md §4.3
 * @see Issue: Canonical differentiation between ACTUAL vs EXPECTED
 */
export function deriveStatus(timeline: Timeline): ContainerStatus {
  let highestStatus: ContainerStatus = 'UNKNOWN'
  let highestIndex = statusDominanceIndex('UNKNOWN')

  for (const obs of timeline.observations) {
    // CRITICAL: Only ACTUAL observations can advance status
    if (obs.event_time_type !== 'ACTUAL') {
      continue
    }

    const impliedStatus = OBSERVATION_TO_STATUS[obs.type]
    if (!impliedStatus) continue

    const idx = statusDominanceIndex(impliedStatus)
    if (idx > highestIndex) {
      highestStatus = impliedStatus
      highestIndex = idx
    }
  }

  // If we have any observations at all but nothing mapped, at least IN_PROGRESS
  if (highestStatus === 'UNKNOWN' && timeline.observations.length > 0) {
    highestStatus = 'IN_PROGRESS'
  }

  return highestStatus
}
