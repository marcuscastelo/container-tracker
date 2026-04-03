import type { TrackingValidationAffectedScope } from '~/modules/tracking/features/validation/domain/model/trackingValidationAffectedScope'
import type { TrackingValidationSeverity } from '~/modules/tracking/features/validation/domain/model/trackingValidationSeverity'

type TrackingValidationFindingMetadataValue = string | number | boolean | null

export type TrackingValidationFinding = {
  readonly detectorId: string
  readonly code: string
  readonly severity: TrackingValidationSeverity
  readonly affectedScope: TrackingValidationAffectedScope
  readonly metadata?: Readonly<Record<string, TrackingValidationFindingMetadataValue>>
}
