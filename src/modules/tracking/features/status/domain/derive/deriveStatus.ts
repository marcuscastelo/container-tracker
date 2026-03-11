import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import { compareObservationsChronologically } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import type { Timeline } from '~/modules/tracking/features/timeline/domain/model/timeline'

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
  // Helper: find the final destination location_code inferred from the timeline.
  // Strategy: walk observations from the end and pick the first observation that
  // is one of DISCHARGE, ARRIVAL or DELIVERY (these indicate arrival/discharge at a port)
  // and has a non-null location_code. Fallback to the last observation with a
  // non-null location_code if none of those types are present.
  let finalLocation: string | null = null
  for (let i = timeline.observations.length - 1; i >= 0; i--) {
    const o = timeline.observations[i]
    if (o.location_code) {
      if (o.type === 'DISCHARGE' || o.type === 'ARRIVAL' || o.type === 'DELIVERY') {
        finalLocation = o.location_code
        break
      }
      // keep as fallback if we don't find a stronger indicator
      if (!finalLocation) finalLocation = o.location_code
    }
  }

  // Build a deterministic ACTUAL-only chronology:
  // 1) event_time ordering
  // 2) ACTUAL/EXPECTED tie policy from timeline comparator
  // 3) stable timeline order fallback for complete ties
  const actualObservations = timeline.observations
    .map((observation, timelineIndex) => ({ observation, timelineIndex }))
    .filter((entry) => entry.observation.event_time_type === 'ACTUAL')
    .sort((a, b) => {
      const chronologyCompare = compareObservationsChronologically(a.observation, b.observation)
      if (chronologyCompare !== 0) return chronologyCompare
      return a.timelineIndex - b.timelineIndex
    })
    .map((entry) => entry.observation)

  // Predicate helpers — only ACTUAL observations are considered for status progression
  const hasActualOfType = (type: keyof typeof OBSERVATION_TO_STATUS) =>
    actualObservations.some((o) => o.type === type)

  const hasActualDischargeAtFinal = () => {
    if (finalLocation === null) return false

    let lastDischargeIndex = -1
    for (let i = actualObservations.length - 1; i >= 0; i--) {
      const observation = actualObservations[i]
      if (observation?.type === 'DISCHARGE' && observation.location_code === finalLocation) {
        lastDischargeIndex = i
        break
      }
    }

    if (lastDischargeIndex === -1) return false

    // IMPORTANT: this guard does NOT depend on vessel change.
    // Any ACTUAL LOAD after the candidate discharge means discharge was not terminal.
    const hasLaterLoad = actualObservations
      .slice(lastDischargeIndex + 1)
      .some((observation) => observation.type === 'LOAD')

    return !hasLaterLoad
  }

  const hasActualArrivalAtFinal = () =>
    finalLocation !== null &&
    actualObservations.some((o) => o.type === 'ARRIVAL' && o.location_code === finalLocation)

  // Follow the explicit dominance order requested by the product rules.
  // EMPTY_RETURN should take precedence over DELIVERY when present
  if (hasActualOfType('EMPTY_RETURN')) return 'EMPTY_RETURNED'
  if (hasActualOfType('DELIVERY')) return 'DELIVERED'
  if (hasActualDischargeAtFinal()) return 'DISCHARGED'
  if (hasActualArrivalAtFinal()) return 'ARRIVED_AT_POD'
  if (hasActualOfType('DEPARTURE')) return 'IN_TRANSIT'
  if (hasActualOfType('LOAD')) return 'LOADED'
  if (hasActualOfType('GATE_IN')) return 'IN_PROGRESS'

  // If there are any observations but none that advance status, report IN_PROGRESS
  if (timeline.observations.length > 0) return 'IN_PROGRESS'

  return 'UNKNOWN'
}
