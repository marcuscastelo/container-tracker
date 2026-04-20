import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import {
  findStrongCompletionMilestones,
  LIFECYCLE_CONTINUATION_TYPES_AFTER_DELIVERED,
  LIFECYCLE_CONTINUATION_TYPES_AFTER_EMPTY_RETURNED,
  type StrongCompletionMilestone,
  type StrongCompletionObservation,
} from '~/modules/tracking/features/status/domain/derive/strongCompletionMilestone'
import { compareObservationsChronologically } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { digestTrackingValidationFingerprint } from '~/modules/tracking/features/validation/domain/services/trackingValidationFingerprint'

type ContainmentCandidateObservation = StrongCompletionObservation &
  Pick<Observation, 'fingerprint'> & {
    readonly entityId: string
  }

export type ContainerReuseContainmentDetection = {
  readonly reasonCode: 'CONTAINER_REUSED_AFTER_COMPLETION'
  readonly evidenceSummary: string
  readonly stateFingerprint: string
}

const IGNORED_TYPES: ReadonlySet<ObservationType> = new Set(['OTHER', 'TERMINAL_MOVE'])
const INCOMPATIBLE_TYPES_BY_COMPLETION_STATUS: Readonly<
  Record<StrongCompletionMilestone['status'], ReadonlySet<ObservationType>>
> = {
  DELIVERED: new Set(LIFECYCLE_CONTINUATION_TYPES_AFTER_DELIVERED),
  EMPTY_RETURNED: new Set(LIFECYCLE_CONTINUATION_TYPES_AFTER_EMPTY_RETURNED),
}

function toSortedTimelineObservations(
  observations: readonly ContainmentCandidateObservation[],
): readonly ContainmentCandidateObservation[] {
  return [...observations].sort(compareObservationsChronologically)
}

function isIncompatiblePostCompletionObservation(
  milestone: StrongCompletionMilestone<ContainmentCandidateObservation>,
  observation: ContainmentCandidateObservation,
): boolean {
  if (IGNORED_TYPES.has(observation.type)) return false

  return INCOMPATIBLE_TYPES_BY_COMPLETION_STATUS[milestone.status].has(observation.type)
}

function findFirstIncompatibleObservation(
  milestone: StrongCompletionMilestone<ContainmentCandidateObservation>,
  observations: readonly ContainmentCandidateObservation[],
): ContainmentCandidateObservation | null {
  const milestoneIndex = observations.findIndex(
    (observation) => observation.entityId === milestone.observation.entityId,
  )
  if (milestoneIndex === -1) return null

  for (const observation of observations.slice(milestoneIndex + 1)) {
    if (isIncompatiblePostCompletionObservation(milestone, observation)) {
      return observation
    }
  }

  return null
}

function describeEvidence(
  milestone: StrongCompletionMilestone<ContainmentCandidateObservation>,
  incompatibleObservation: ContainmentCandidateObservation,
): string {
  return `${incompatibleObservation.type} ${incompatibleObservation.event_time_type} appeared after ${milestone.status}.`
}

function createDetection(
  milestone: StrongCompletionMilestone<ContainmentCandidateObservation>,
  incompatibleObservation: ContainmentCandidateObservation,
): ContainerReuseContainmentDetection {
  return {
    reasonCode: 'CONTAINER_REUSED_AFTER_COMPLETION',
    evidenceSummary: describeEvidence(milestone, incompatibleObservation),
    stateFingerprint: digestTrackingValidationFingerprint([
      milestone.status,
      milestone.source,
      milestone.observation.entityId,
      incompatibleObservation.type,
      incompatibleObservation.event_time_type,
      incompatibleObservation.entityId,
      incompatibleObservation.fingerprint,
    ]),
  }
}

export function detectContainerReuseAfterCompletion(
  observations: readonly ContainmentCandidateObservation[],
): ContainerReuseContainmentDetection | null {
  const sortedTimelineObservations = toSortedTimelineObservations(observations)
  const completionMilestones = findStrongCompletionMilestones(sortedTimelineObservations)

  for (let index = completionMilestones.length - 1; index >= 0; index -= 1) {
    const milestone = completionMilestones[index]
    if (milestone === undefined) {
      continue
    }

    const incompatibleObservation = findFirstIncompatibleObservation(
      milestone,
      sortedTimelineObservations,
    )
    if (incompatibleObservation !== null) {
      return createDetection(milestone, incompatibleObservation)
    }
  }

  return null
}
