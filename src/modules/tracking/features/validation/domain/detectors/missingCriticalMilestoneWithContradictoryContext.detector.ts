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

type MaritimeLeg = {
  readonly startChronologyIndex: number
  readonly observations: readonly MaritimeObservation[]
}

type ContradictionSignal = {
  readonly missingMilestone: MissingMilestone
  readonly previousObservation: MaritimeObservation
  readonly anchorObservation: MaritimeObservation
  readonly anchorChronologyIndex: number
  readonly anchorLegIndex: number
  readonly legObservations: readonly MaritimeObservation[]
}

function isMaritimeObservation(observation: Observation): observation is MaritimeObservation {
  return (
    observation.type === 'LOAD' ||
    observation.type === 'DEPARTURE' ||
    observation.type === 'ARRIVAL' ||
    observation.type === 'DISCHARGE'
  )
}

function toActualMaritimeObservationChronology(
  observations: readonly Observation[],
): readonly MaritimeObservation[] {
  return toActualObservationChronology(observations).filter(isMaritimeObservation)
}

function segmentActualMaritimeLegs(
  maritimeObservations: readonly MaritimeObservation[],
): readonly MaritimeLeg[] {
  const legs: Array<{
    startChronologyIndex: number
    observations: MaritimeObservation[]
  }> = []
  let currentLeg: {
    startChronologyIndex: number
    observations: MaritimeObservation[]
  } | null = null

  for (const [chronologyIndex, observation] of maritimeObservations.entries()) {
    if (observation.type === 'LOAD') {
      currentLeg = {
        startChronologyIndex: chronologyIndex,
        observations: [observation],
      }
      legs.push(currentLeg)
      continue
    }

    if (currentLeg === null) {
      currentLeg = {
        startChronologyIndex: chronologyIndex,
        observations: [observation],
      }
      legs.push(currentLeg)
      continue
    }

    currentLeg.observations.push(observation)
  }

  return legs
}

function detectLegSequenceGaps(leg: MaritimeLeg): readonly ContradictionSignal[] {
  let previousMaritimeObservation: MaritimeObservation | null = null
  let missingDeparture: ContradictionSignal | null = null
  let missingArrival: ContradictionSignal | null = null

  for (const [legIndex, observation] of leg.observations.entries()) {
    const chronologyIndex = leg.startChronologyIndex + legIndex

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
        anchorLegIndex: legIndex,
        legObservations: leg.observations,
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
        anchorLegIndex: legIndex,
        legObservations: leg.observations,
      }
    }

    previousMaritimeObservation = observation
  }

  return [missingDeparture, missingArrival].filter(
    (signal): signal is ContradictionSignal => signal !== null,
  )
}

function sharesObservedLocation(
  left: Pick<Observation, 'location_code' | 'location_display'>,
  right: Pick<Observation, 'location_code' | 'location_display'>,
): boolean {
  const leftLocationCode = normalizeLocationCode(left.location_code)
  const rightLocationCode = normalizeLocationCode(right.location_code)

  if (leftLocationCode !== null && rightLocationCode !== null) {
    return leftLocationCode === rightLocationCode
  }

  const leftLocationDisplay = normalizeLocationDisplay(left.location_display)
  const rightLocationDisplay = normalizeLocationDisplay(right.location_display)

  if (leftLocationDisplay !== null && rightLocationDisplay !== null) {
    return leftLocationDisplay === rightLocationDisplay
  }

  return true
}

function normalizeLocationCode(locationCode: string | null): string | null {
  if (locationCode === null) {
    return null
  }

  const normalizedLocationCode = locationCode.trim().toUpperCase()
  return normalizedLocationCode.length > 0 ? normalizedLocationCode : null
}

function normalizeLocationDisplay(locationDisplay: string | null): string | null {
  if (locationDisplay === null) {
    return null
  }

  const normalizedLocationDisplay = locationDisplay
    .trim()
    .replace(/\s+/g, ' ')
    .split(',')[0]
    ?.trim()
    .toUpperCase()

  return normalizedLocationDisplay && normalizedLocationDisplay.length > 0
    ? normalizedLocationDisplay
    : null
}

function hasRepeatedDownstreamMilestone(signal: ContradictionSignal): boolean {
  for (
    let legIndex = signal.anchorLegIndex + 1;
    legIndex < signal.legObservations.length;
    legIndex += 1
  ) {
    const candidate = signal.legObservations[legIndex]
    if (
      candidate?.type === signal.anchorObservation.type &&
      !sharesObservedLocation(candidate, signal.anchorObservation)
    ) {
      return true
    }
  }

  return false
}

function selectFirstConfirmedSignalPerMissingMilestone(
  signals: readonly ContradictionSignal[],
): readonly ContradictionSignal[] {
  const firstByMissingMilestone = new Map<MissingMilestone, ContradictionSignal>()

  for (const signal of signals) {
    const existing = firstByMissingMilestone.get(signal.missingMilestone)
    if (existing === undefined || signal.anchorChronologyIndex < existing.anchorChronologyIndex) {
      firstByMissingMilestone.set(signal.missingMilestone, signal)
    }
  }

  return [...firstByMissingMilestone.values()].sort(
    (left, right) => left.anchorChronologyIndex - right.anchorChronologyIndex,
  )
}

function detectMaritimeSequenceGaps(
  maritimeObservations: readonly MaritimeObservation[],
): readonly ContradictionSignal[] {
  const candidateSignals = segmentActualMaritimeLegs(maritimeObservations)
    .flatMap((leg) => detectLegSequenceGaps(leg))
    .filter((signal) => hasRepeatedDownstreamMilestone(signal))

  return selectFirstConfirmedSignalPerMissingMilestone(candidateSignals)
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
      const maritimeObservations = toActualMaritimeObservationChronology(
        context.timeline.observations,
      )

      return detectMaritimeSequenceGaps(maritimeObservations).map((signal) =>
        createFinding(context.containerId, signal),
      )
    },
  }
