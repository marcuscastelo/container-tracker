import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import {
  findStrongCompletionMilestones,
  LIFECYCLE_CONTINUATION_TYPES_AFTER_DELIVERED,
  LIFECYCLE_CONTINUATION_TYPES_AFTER_EMPTY_RETURNED,
  type StrongCompletionMilestone,
} from '~/modules/tracking/features/status/domain/derive/strongCompletionMilestone'
import { compareObservationsChronologically } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import type { TrackingValidationDetector } from '~/modules/tracking/features/validation/domain/model/trackingValidationDetector'
import type { TrackingValidationFinding } from '~/modules/tracking/features/validation/domain/model/trackingValidationFinding'
import { digestTrackingValidationFingerprint } from '~/modules/tracking/features/validation/domain/services/trackingValidationFingerprint'

const DETECTOR_ID = 'POST_COMPLETION_TRACKING_CONTINUED'
const DETECTOR_VERSION = '1'
const SUMMARY_KEY = 'tracking.validation.postCompletionTrackingContinued'
const IGNORED_TYPES: ReadonlySet<ObservationType> = new Set(['OTHER', 'TERMINAL_MOVE'])
const INCOMPATIBLE_TYPES_BY_COMPLETION_STATUS: Readonly<
  Record<StrongCompletionMilestone['status'], ReadonlySet<ObservationType>>
> = {
  DELIVERED: new Set(LIFECYCLE_CONTINUATION_TYPES_AFTER_DELIVERED),
  EMPTY_RETURNED: new Set(LIFECYCLE_CONTINUATION_TYPES_AFTER_EMPTY_RETURNED),
}

function toSortedTimelineObservations(
  observations: readonly Observation[],
): readonly Observation[] {
  return [...observations].sort(compareObservationsChronologically)
}

function isIncompatiblePostCompletionObservation(
  milestone: StrongCompletionMilestone,
  observation: Observation,
): boolean {
  if (IGNORED_TYPES.has(observation.type)) return false

  return INCOMPATIBLE_TYPES_BY_COMPLETION_STATUS[milestone.status].has(observation.type)
}

function findFirstIncompatibleObservation(
  milestone: StrongCompletionMilestone,
  observations: readonly Observation[],
): Observation | null {
  const milestoneIndex = observations.findIndex(
    (observation) => observation.id === milestone.observation.id,
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
  milestone: StrongCompletionMilestone,
  incompatibleObservation: Observation,
): string {
  return `${incompatibleObservation.type} ${incompatibleObservation.event_time_type} appeared after ${milestone.status}.`
}

function createFinding(
  containerId: string,
  milestone: StrongCompletionMilestone,
  incompatibleObservation: Observation,
): TrackingValidationFinding {
  return {
    detectorId: DETECTOR_ID,
    detectorVersion: DETECTOR_VERSION,
    code: DETECTOR_ID,
    lifecycleKey: `${DETECTOR_ID}:${containerId}`,
    stateFingerprint: digestTrackingValidationFingerprint([
      milestone.status,
      milestone.source,
      milestone.observation.id,
      incompatibleObservation.type,
      incompatibleObservation.event_time_type,
      incompatibleObservation.id,
      incompatibleObservation.fingerprint,
    ]),
    severity: 'CRITICAL',
    affectedScope: 'TIMELINE',
    summaryKey: SUMMARY_KEY,
    affectedLocation: null,
    affectedBlockLabelKey: null,
    evidenceSummary: describeEvidence(milestone, incompatibleObservation),
    debugEvidence: {
      completionObservationId: milestone.observation.id,
      completionSource: milestone.source,
      completionStatus: milestone.status,
      continuationEventTimeType: incompatibleObservation.event_time_type,
      continuationObservationId: incompatibleObservation.id,
      continuationType: incompatibleObservation.type,
    },
    isActive: true,
  }
}

export const postCompletionTrackingContinuedDetector: TrackingValidationDetector = {
  id: DETECTOR_ID,
  version: DETECTOR_VERSION,
  detect(context) {
    const sortedTimelineObservations = toSortedTimelineObservations(context.timeline.observations)
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
        return [createFinding(context.containerId, milestone, incompatibleObservation)]
      }
    }

    return []
  },
}
