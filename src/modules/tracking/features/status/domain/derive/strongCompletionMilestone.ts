import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import { compareObservationsChronologically } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'

export const LIFECYCLE_CONTINUATION_TYPES_AFTER_EMPTY_RETURNED: readonly ObservationType[] = [
  'GATE_IN',
  'GATE_OUT',
  'LOAD',
  'DEPARTURE',
  'ARRIVAL',
  'DISCHARGE',
]

export const LIFECYCLE_CONTINUATION_TYPES_AFTER_DELIVERED: readonly ObservationType[] = [
  'GATE_IN',
  'LOAD',
  'DEPARTURE',
  'ARRIVAL',
  'DISCHARGE',
]

export type StrongCompletionStatus = Extract<ContainerStatus, 'DELIVERED' | 'EMPTY_RETURNED'>

export type StrongCompletionObservation = Pick<
  Observation,
  'type' | 'event_time' | 'event_time_type' | 'created_at' | 'is_empty'
>

export type StrongCompletionMilestone<
  TObservation extends StrongCompletionObservation = Observation,
> = {
  readonly status: StrongCompletionStatus
  readonly observation: TObservation
  readonly chronologyIndex: number
  readonly source: 'DELIVERY' | 'DELIVERY_GATE_OUT' | 'EMPTY_RETURN' | 'EMPTY_RETURN_GATE_OUT'
}

export function toActualObservationChronology<TObservation extends StrongCompletionObservation>(
  observations: readonly TObservation[],
): readonly TObservation[] {
  return observations
    .map((observation, timelineIndex) => ({ observation, timelineIndex }))
    .filter((entry) => entry.observation.event_time_type === 'ACTUAL')
    .sort((a, b) => {
      const chronologyCompare = compareObservationsChronologically(a.observation, b.observation)
      if (chronologyCompare !== 0) return chronologyCompare
      return a.timelineIndex - b.timelineIndex
    })
    .map((entry) => entry.observation)
}

export function findStrongCompletionMilestones<TObservation extends StrongCompletionObservation>(
  observations: readonly TObservation[],
): readonly StrongCompletionMilestone<TObservation>[] {
  const actualObservations = toActualObservationChronology(observations)
  const milestones: StrongCompletionMilestone<TObservation>[] = []

  for (const [chronologyIndex, observation] of actualObservations.entries()) {
    if (observation.type === 'EMPTY_RETURN') {
      milestones.push({
        status: 'EMPTY_RETURNED',
        observation,
        chronologyIndex,
        source: 'EMPTY_RETURN',
      })
      continue
    }

    if (observation.type === 'DELIVERY') {
      milestones.push({
        status: 'DELIVERED',
        observation,
        chronologyIndex,
        source: 'DELIVERY',
      })
      continue
    }

    if (observation.type !== 'GATE_OUT') continue

    const hasActualDischargeBeforeGateOut = actualObservations
      .slice(0, chronologyIndex)
      .some((candidate) => candidate.type === 'DISCHARGE')
    if (!hasActualDischargeBeforeGateOut) continue

    if (observation.is_empty === true) {
      milestones.push({
        status: 'EMPTY_RETURNED',
        observation,
        chronologyIndex,
        source: 'EMPTY_RETURN_GATE_OUT',
      })
      continue
    }

    milestones.push({
      status: 'DELIVERED',
      observation,
      chronologyIndex,
      source: 'DELIVERY_GATE_OUT',
    })
  }

  return milestones
}
