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

type ContradictionSignal = {
  readonly missingMilestone: MissingMilestone
  readonly previousObservation: Observation
  readonly anchorObservation: Observation
}

function isMaritimeObservationType(type: Observation['type']): type is MaritimeObservationType {
  return type === 'LOAD' || type === 'DEPARTURE' || type === 'ARRIVAL' || type === 'DISCHARGE'
}

function detectContradictionSignals(
  observations: readonly Observation[],
): readonly ContradictionSignal[] {
  let previousMaritimeObservation: Observation | null = null
  let missingDeparture: ContradictionSignal | null = null
  let missingArrival: ContradictionSignal | null = null

  for (const observation of toActualObservationChronology(observations)) {
    if (!isMaritimeObservationType(observation.type)) {
      continue
    }

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
      }
    }

    previousMaritimeObservation = observation
  }

  return [missingDeparture, missingArrival].filter(
    (signal): signal is ContradictionSignal => signal !== null,
  )
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
      return detectContradictionSignals(context.timeline.observations).map((signal) =>
        createFinding(context.containerId, signal),
      )
    },
  }
