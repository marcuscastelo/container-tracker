import type { TrackingValidationAffectedScope } from '~/modules/tracking/features/validation/domain/model/trackingValidationAffectedScope'
import type { TrackingValidationSeverity } from '~/modules/tracking/features/validation/domain/model/trackingValidationSeverity'

export type TrackingValidationDebugEvidenceValue = string | number | boolean | null
export type TrackingValidationDebugEvidence = Readonly<
  Record<string, TrackingValidationDebugEvidenceValue>
>

export type TrackingValidationFinding = {
  readonly detectorId: string
  readonly detectorVersion: string
  readonly code: string
  readonly lifecycleKey: string
  readonly stateFingerprint: string
  readonly severity: TrackingValidationSeverity
  readonly affectedScope: TrackingValidationAffectedScope
  readonly summaryKey: string
  readonly affectedLocation: string | null
  readonly affectedBlockLabelKey: string | null
  readonly evidenceSummary: string
  readonly debugEvidence?: TrackingValidationDebugEvidence
  readonly isActive: boolean
}
