import { expect } from 'vitest'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import type { Timeline } from '~/modules/tracking/features/timeline/domain/model/timeline'

export type TransshipmentSemanticViolation = {
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

  const latestLoadWithVessel = [...actualObservations]
    .reverse()
    .find((observation) => observation.type === 'LOAD' && observation.vessel_name)

  if (latestLoadWithVessel) {
    violations.push({
      code: 'onboard_vessel_with_arrival_like_status',
      status,
      latest_actual_type: latestLoadWithVessel.type,
      latest_actual_vessel_name: latestLoadWithVessel.vessel_name,
    })
  }

  const hasArrivalOrDischarge = actualObservations.some((observation) => {
    return observation.type === 'ARRIVAL' || observation.type === 'DISCHARGE'
  })
  const hasLoadAfterArrivalOrDischarge = (() => {
    for (let i = 0; i < actualObservations.length; i++) {
      const observation = actualObservations[i]
      if (observation.type !== 'ARRIVAL' && observation.type !== 'DISCHARGE') continue
      const hasLaterLoad = actualObservations
        .slice(i + 1)
        .some((laterObservation) => laterObservation.type === 'LOAD')
      if (hasLaterLoad) return true
    }
    return false
  })()

  if (hasArrivalOrDischarge && hasLoadAfterArrivalOrDischarge) {
    violations.push({
      code: 'post_transshipment_load_ignored',
      status,
      latest_actual_type: latestActual?.type ?? null,
      latest_actual_vessel_name: latestActual?.vessel_name ?? null,
    })
  }

  return violations
}

export function assertNoTransshipmentSemanticViolations(
  timeline: Timeline,
  status: ContainerStatus,
): void {
  expect(collectTransshipmentSemanticViolations(timeline, status)).toEqual([])
}
