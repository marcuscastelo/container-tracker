import { expect } from 'vitest'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import type { Timeline } from '~/modules/tracking/features/timeline/domain/model/timeline'

type TransshipmentSemanticViolation = {
  readonly code:
    | 'latest_actual_load_with_arrival_like_status'
    | 'onboard_vessel_with_arrival_like_status'
    | 'post_transshipment_load_ignored'
  readonly status: ContainerStatus
  readonly latest_actual_type: string | null
  readonly latest_actual_vessel_name: string | null
}

const ARRIVAL_LIKE_STATUSES = new Set<ContainerStatus>(['ARRIVED_AT_POD', 'DISCHARGED'])

function isArrivalLikeStatus(status: ContainerStatus): boolean {
  return ARRIVAL_LIKE_STATUSES.has(status)
}

function getActualObservations(timeline: Timeline) {
  return timeline.observations.filter((observation) => observation.event_time_type === 'ACTUAL')
}

function getFinalLocation(
  actualObservations: ReturnType<typeof getActualObservations>,
): string | null {
  let fallbackLocation: string | null = null

  for (let i = actualObservations.length - 1; i >= 0; i--) {
    const observation = actualObservations[i]
    if (!observation?.location_code) continue

    if (
      observation.type === 'DISCHARGE' ||
      observation.type === 'ARRIVAL' ||
      observation.type === 'DELIVERY'
    ) {
      return observation.location_code
    }

    if (!fallbackLocation) {
      fallbackLocation = observation.location_code
    }
  }

  return fallbackLocation
}

function findLastArrivalOrDischargeIndexAtFinalLocation(
  actualObservations: ReturnType<typeof getActualObservations>,
): number {
  const finalLocation = getFinalLocation(actualObservations)
  if (finalLocation === null) return -1

  for (let i = actualObservations.length - 1; i >= 0; i--) {
    const observation = actualObservations[i]
    if (
      observation?.location_code === finalLocation &&
      (observation.type === 'ARRIVAL' || observation.type === 'DISCHARGE')
    ) {
      return i
    }
  }

  return -1
}

export function collectTransshipmentSemanticViolations(
  timeline: Timeline,
  status: ContainerStatus,
): TransshipmentSemanticViolation[] {
  const violations: TransshipmentSemanticViolation[] = []
  const actualObservations = getActualObservations(timeline)
  const latestActual = actualObservations[actualObservations.length - 1] ?? null

  if (!isArrivalLikeStatus(status)) {
    return violations
  }

  if (latestActual?.type === 'LOAD') {
    violations.push({
      code: 'latest_actual_load_with_arrival_like_status',
      status,
      latest_actual_type: latestActual.type,
      latest_actual_vessel_name: latestActual.vessel_name,
    })
  }

  const lastArrivalOrDischargeAtFinalIndex =
    findLastArrivalOrDischargeIndexAtFinalLocation(actualObservations)
  if (lastArrivalOrDischargeAtFinalIndex !== -1) {
    const observationsAfterCandidate = actualObservations.slice(
      lastArrivalOrDischargeAtFinalIndex + 1,
    )
    const loadsAfterCandidate = observationsAfterCandidate.filter((observation) => {
      return observation.type === 'LOAD'
    })

    if (loadsAfterCandidate.length > 0) {
      const latestLoadAfterCandidate = loadsAfterCandidate[loadsAfterCandidate.length - 1]

      violations.push({
        code: 'post_transshipment_load_ignored',
        status,
        latest_actual_type: latestActual?.type ?? null,
        latest_actual_vessel_name: latestActual?.vessel_name ?? null,
      })

      if (
        typeof latestLoadAfterCandidate?.vessel_name === 'string' &&
        latestLoadAfterCandidate.vessel_name.trim().length > 0
      ) {
        violations.push({
          code: 'onboard_vessel_with_arrival_like_status',
          status,
          latest_actual_type: latestLoadAfterCandidate.type,
          latest_actual_vessel_name: latestLoadAfterCandidate.vessel_name,
        })
      }
    }
  }

  return violations
}

export function assertNoTransshipmentSemanticViolations(
  timeline: Timeline,
  status: ContainerStatus,
): void {
  expect(collectTransshipmentSemanticViolations(timeline, status)).toEqual([])
}
