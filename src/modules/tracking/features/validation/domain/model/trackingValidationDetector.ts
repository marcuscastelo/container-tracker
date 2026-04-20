import type { TrackingValidationContext } from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
import type { TrackingValidationFinding } from '~/modules/tracking/features/validation/domain/model/trackingValidationFinding'

export type TrackingValidationDetector = {
  readonly id: string
  readonly version: string
  detect(context: TrackingValidationContext): readonly TrackingValidationFinding[]
}
