import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { toActualObservationChronology } from '~/modules/tracking/features/status/domain/derive/strongCompletionMilestone'
import type { TrackingValidationDetector } from '~/modules/tracking/features/validation/domain/model/trackingValidationDetector'
import type { TrackingValidationFinding } from '~/modules/tracking/features/validation/domain/model/trackingValidationFinding'
import { digestTrackingValidationFingerprint } from '~/modules/tracking/features/validation/domain/services/trackingValidationFingerprint'

const DETECTOR_ID = 'MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT'
const DETECTOR_VERSION = '1'
const SUMMARY_KEY = 'tracking.validation.missingCriticalMilestoneWithContradictoryContext'

type MissingMilestone = 'ARRIVAL' | 'DEPARTURE'
type MaritimeObservationType = Extract<
  Observation['type'],
  'ARRIVAL' | 'DEPARTURE' | 'DISCHARGE' | 'LOAD'
>
type MaritimeObservation = Observation & {
  readonly type: MaritimeObservationType
}

type ContradictionSignal = {
  readonly missingMilestone: MissingMilestone
  readonly previousObservation: MaritimeObservation
  readonly anchorObservation: MaritimeObservation
  readonly anchorChronologyIndex: number
}

function isMaritimeObservationType(type: Observation['type']): type is MaritimeObservationType {
  return type === 'LOAD' || type === 'DEPARTURE' || type === 'ARRIVAL' || type === 'DISCHARGE'
}

function isMaritimeObservation(observation: Observation): observation is MaritimeObservation {
  return isMaritimeObservationType(observation.type)
}

function toActualMaritimeObservationChronology(
  observations: readonly Observation[],
): readonly MaritimeObservation[] {
  return toActualObservationChronology(observations).filter(isMaritimeObservation)
}

function detectMaritimeSequenceGaps(
  maritimeObservations: readonly MaritimeObservation[],
): readonly ContradictionSignal[] {
  let previousMaritimeObservation: MaritimeObservation | null = null
  let missingDeparture: ContradictionSignal | null = null
  let missingArrival: ContradictionSignal | null = null

  for (const [chronologyIndex, observation] of maritimeObservations.entries()) {
    if (
      previousMaritimeObservation !== null &&
      missingDeparture === null &&
      previousMaritimeObservation.type === 'LOAD' &&
      (observation.type === 'ARRIVAL' || observation.type === 'DISCHARGE')
    ) {
      missingDeparture = {
        missingMilestone: 'DEPARTURE',
        previousObservation: previousMaritimeObservation,
        anchorObservation: observation,
        anchorChronologyIndex: chronologyIndex,
      }
    }

    if (
      previousMaritimeObservation !== null &&
      missingArrival === null &&
      previousMaritimeObservation.type === 'DEPARTURE' &&
      observation.type === 'DISCHARGE'
    ) {
      missingArrival = {
        missingMilestone: 'ARRIVAL',
        previousObservation: previousMaritimeObservation,
        anchorObservation: observation,
        anchorChronologyIndex: chronologyIndex,
      }
    }

    previousMaritimeObservation = observation
  }

  return [missingDeparture, missingArrival].filter(
    (signal): signal is ContradictionSignal => signal !== null,
  )
}

function hasRepeatedDownstreamMilestone(
  signal: ContradictionSignal,
  maritimeObservations: readonly MaritimeObservation[],
): boolean {
  for (
    let chronologyIndex = signal.anchorChronologyIndex + 1;
    chronologyIndex < maritimeObservations.length;
    chronologyIndex += 1
  ) {
    if (maritimeObservations[chronologyIndex]?.type === signal.anchorObservation.type) {
      return true
    }
  }

  return false
}

function hasAdditionalContradictoryEvidence(
  signal: ContradictionSignal,
  maritimeObservations: readonly MaritimeObservation[],
): boolean {
  return hasRepeatedDownstreamMilestone(signal, maritimeObservations)
}

function describeEvidence(signal: ContradictionSignal): string {
  return `${signal.anchorObservation.type} ACTUAL appeared after ${signal.previousObservation.type} without ${signal.missingMilestone} in the canonical maritime sequence.`
}

function createFinding(
  containerId: string,
  signal: ContradictionSignal,
): TrackingValidationFinding {
  return {
    detectorId: DETECTOR_ID,
    detectorVersion: DETECTOR_VERSION,
    code: DETECTOR_ID,
    lifecycleKey: `${DETECTOR_ID}:${containerId}:missing-${signal.missingMilestone}`,
    stateFingerprint: digestTrackingValidationFingerprint([
      signal.missingMilestone,
      signal.previousObservation.id,
      signal.previousObservation.fingerprint,
      signal.anchorObservation.id,
      signal.anchorObservation.fingerprint,
    ]),
    severity: 'ADVISORY',
    affectedScope: 'TIMELINE',
    summaryKey: SUMMARY_KEY,
    affectedLocation: signal.anchorObservation.location_code ?? null,
    affectedBlockLabelKey: null,
    evidenceSummary: describeEvidence(signal),
    debugEvidence: {
      anchorObservationId: signal.anchorObservation.id,
      anchorObservationType: signal.anchorObservation.type,
      locationCode: signal.anchorObservation.location_code,
      missingMilestone: signal.missingMilestone,
      previousObservationId: signal.previousObservation.id,
      previousObservationType: signal.previousObservation.type,
    },
    isActive: true,
  }
}

export const missingCriticalMilestoneWithContradictoryContextDetector: TrackingValidationDetector =
  {
    id: DETECTOR_ID,
    version: DETECTOR_VERSION,
    detect(context) {
      const maritimeObservations = toActualMaritimeObservationChronology(context.timeline.observations)

      return detectMaritimeSequenceGaps(maritimeObservations)
        .filter((signal) => hasAdditionalContradictoryEvidence(signal, maritimeObservations))
        .map((signal) => createFinding(context.containerId, signal))
    },
  }
