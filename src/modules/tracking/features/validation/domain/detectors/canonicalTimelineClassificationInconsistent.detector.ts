import type {
  TrackingValidationContext,
  TrackingValidationPostCarriageMaritimeEventSignal,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
import type { TrackingValidationDetector } from '~/modules/tracking/features/validation/domain/model/trackingValidationDetector'
import type { TrackingValidationFinding } from '~/modules/tracking/features/validation/domain/model/trackingValidationFinding'
import {
  digestTrackingValidationFingerprint,
  normalizeTrackingValidationFingerprintPart,
} from '~/modules/tracking/features/validation/domain/services/trackingValidationFingerprint'

const DETECTOR_ID = 'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT'
const DETECTOR_VERSION = '1'
const SUMMARY_KEY = 'tracking.validation.canonicalTimelineClassificationInconsistent'

function describeEvidence(
  signals: readonly TrackingValidationPostCarriageMaritimeEventSignal[],
): string {
  const eventTypes = [...new Set(signals.map((signal) => signal.type))].join(', ')
  const locations = [
    ...new Set(signals.map((signal) => signal.location).filter((value) => value !== null)),
  ]

  if (locations.length === 0) {
    return `Post-carriage block contains maritime events (${eventTypes}).`
  }

  return `Post-carriage block contains maritime events (${eventTypes}) at ${locations.join(', ')}.`
}

function createFinding(
  containerId: string,
  signals: readonly TrackingValidationPostCarriageMaritimeEventSignal[],
): TrackingValidationFinding {
  const eventTypes = [...new Set(signals.map((signal) => signal.type))].join(', ')
  const hasVesselContext = signals.some((signal) => signal.hasVesselContext)
  const hasVoyageContext = signals.some((signal) => signal.hasVoyageContext)
  const sortedSignalParts = [...signals]
    .map((signal) =>
      [
        signal.type,
        signal.eventTimeType,
        normalizeTrackingValidationFingerprintPart(signal.location),
        signal.hasVesselContext ? '1' : '0',
        signal.hasVoyageContext ? '1' : '0',
      ].join(':'),
    )
    .sort()

  return {
    detectorId: DETECTOR_ID,
    detectorVersion: DETECTOR_VERSION,
    code: DETECTOR_ID,
    lifecycleKey: `${DETECTOR_ID}:${containerId}`,
    stateFingerprint: digestTrackingValidationFingerprint(sortedSignalParts),
    severity: 'ADVISORY',
    affectedScope: 'TIMELINE',
    summaryKey: SUMMARY_KEY,
    evidenceSummary: describeEvidence(signals),
    debugEvidence: {
      maritimeEventCount: signals.length,
      maritimeEventTypes: eventTypes,
      hasVesselContext,
      hasVoyageContext,
    },
    isActive: true,
  }
}

export const canonicalTimelineClassificationInconsistentDetector: TrackingValidationDetector = {
  id: DETECTOR_ID,
  version: DETECTOR_VERSION,
  detect(context: TrackingValidationContext): readonly TrackingValidationFinding[] {
    const signals = context.derivedSignals.canonicalTimeline.postCarriageMaritimeEvents
    if (signals.length === 0) return []

    return [createFinding(context.containerId, signals)]
  },
}
