import type { TrackingValidationContext } from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
import type { TrackingValidationDetector } from '~/modules/tracking/features/validation/domain/model/trackingValidationDetector'
import type { TrackingValidationFinding } from '~/modules/tracking/features/validation/domain/model/trackingValidationFinding'

export type TrackingValidationRegistry = {
  readonly detectors: readonly TrackingValidationDetector[]
  evaluate(context: TrackingValidationContext): readonly TrackingValidationFinding[]
}

export function createTrackingValidationRegistry(
  detectors: readonly TrackingValidationDetector[],
): TrackingValidationRegistry {
  const knownIds = new Set<string>()

  for (const detector of detectors) {
    if (knownIds.has(detector.id)) {
      throw new Error(`Duplicate tracking validation detector id: ${detector.id}`)
    }

    knownIds.add(detector.id)
  }

  return {
    detectors,
    evaluate(context) {
      const findings: TrackingValidationFinding[] = []

      for (const detector of detectors) {
        for (const finding of detector.detect(context)) {
          if (finding.detectorId !== detector.id) {
            throw new Error(
              `Tracking validation finding detector mismatch: ${detector.id} != ${finding.detectorId}`,
            )
          }
          if (finding.detectorVersion !== detector.version) {
            throw new Error(
              `Tracking validation finding detector version mismatch: ${detector.version} != ${finding.detectorVersion}`,
            )
          }
          if (finding.lifecycleKey.trim().length === 0) {
            throw new Error(`Tracking validation finding lifecycleKey is empty: ${detector.id}`)
          }
          if (finding.stateFingerprint.trim().length === 0) {
            throw new Error(`Tracking validation finding stateFingerprint is empty: ${detector.id}`)
          }

          findings.push(finding)
        }
      }

      return findings
    },
  }
}
