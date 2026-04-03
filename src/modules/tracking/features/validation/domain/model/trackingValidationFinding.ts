import type { TrackingValidationAffectedScope } from '~/modules/tracking/features/validation/domain/model/trackingValidationAffectedScope'
import type { TrackingValidationSeverity } from '~/modules/tracking/features/validation/domain/model/trackingValidationSeverity'

type TrackingValidationFindingMetadataValue = string | number | boolean | null

export type TrackingValidationFinding = {
  readonly detectorId: string
  readonly detectorVersion: string
  readonly code: string
  readonly severity: TrackingValidationSeverity
  readonly affectedScope: TrackingValidationAffectedScope
  readonly summaryKey: string
  readonly evidenceSummary: string
  readonly isActive: boolean
  readonly metadata?: Readonly<Record<string, TrackingValidationFindingMetadataValue>>
}
