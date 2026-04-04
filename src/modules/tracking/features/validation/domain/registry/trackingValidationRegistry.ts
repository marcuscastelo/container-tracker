import type { TrackingValidationContext } from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
import type { TrackingValidationDetector } from '~/modules/tracking/features/validation/domain/model/trackingValidationDetector'
import type { TrackingValidationFinding } from '~/modules/tracking/features/validation/domain/model/trackingValidationFinding'

export type TrackingValidationRegistry = {
  readonly detectors: readonly TrackingValidationDetector[]
  evaluate(context: TrackingValidationContext): readonly TrackingValidationFinding[]
}

const TRACKING_VALIDATION_ID_PATTERN = /^[A-Z][A-Z0-9_]*$/u
const TRACKING_VALIDATION_SUMMARY_KEY_PREFIX = 'tracking.validation.'
const TRACKING_VALIDATION_MAX_EVIDENCE_SUMMARY_LENGTH = 200

function assertNonBlank(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`Tracking validation ${label} is empty`)
  }
}

function assertUpperSnakeCaseId(value: string, label: string): void {
  assertNonBlank(value, label)
  if (!TRACKING_VALIDATION_ID_PATTERN.test(value)) {
    throw new Error(`Tracking validation ${label} must be UPPER_SNAKE_CASE: ${value}`)
  }
}

function assertSummaryKey(summaryKey: string): void {
  assertNonBlank(summaryKey, 'summaryKey')
  if (!summaryKey.startsWith(TRACKING_VALIDATION_SUMMARY_KEY_PREFIX)) {
    throw new Error(
      `Tracking validation summaryKey must start with ${TRACKING_VALIDATION_SUMMARY_KEY_PREFIX}: ${summaryKey}`,
    )
  }
}

function assertEvidenceSummary(evidenceSummary: string): void {
  const trimmedLength = evidenceSummary.trim().length
  if (trimmedLength === 0) {
    throw new Error('Tracking validation evidenceSummary is empty')
  }
  if (trimmedLength > TRACKING_VALIDATION_MAX_EVIDENCE_SUMMARY_LENGTH) {
    throw new Error(
      `Tracking validation evidenceSummary exceeds ${TRACKING_VALIDATION_MAX_EVIDENCE_SUMMARY_LENGTH} characters`,
    )
  }
}

function assertOptionalNonBlank(value: string | null, label: string): void {
  if (value === null) {
    return
  }

  if (value.trim().length === 0) {
    throw new Error(`Tracking validation ${label} is empty`)
  }
}

export function createTrackingValidationRegistry(
  detectors: readonly TrackingValidationDetector[],
): TrackingValidationRegistry {
  const knownIds = new Set<string>()

  for (const detector of detectors) {
    assertUpperSnakeCaseId(detector.id, 'detectorId')
    assertNonBlank(detector.version, 'detectorVersion')
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
          if (finding.code !== detector.id) {
            throw new Error(
              `Tracking validation finding code mismatch: ${detector.id} != ${finding.code}`,
            )
          }
          if (finding.detectorVersion !== detector.version) {
            throw new Error(
              `Tracking validation finding detector version mismatch: ${detector.version} != ${finding.detectorVersion}`,
            )
          }
          assertUpperSnakeCaseId(finding.detectorId, 'finding.detectorId')
          assertUpperSnakeCaseId(finding.code, 'finding.code')
          assertSummaryKey(finding.summaryKey)
          assertEvidenceSummary(finding.evidenceSummary)
          if (finding.lifecycleKey.trim().length === 0) {
            throw new Error(`Tracking validation finding lifecycleKey is empty: ${detector.id}`)
          }
          if (finding.stateFingerprint.trim().length === 0) {
            throw new Error(`Tracking validation finding stateFingerprint is empty: ${detector.id}`)
          }
          assertOptionalNonBlank(finding.affectedLocation, 'affectedLocation')
          assertOptionalNonBlank(finding.affectedBlockLabelKey, 'affectedBlockLabelKey')

          findings.push(finding)
        }
      }

      return findings
    },
  }
}
