import { conflictingCriticalActualsDetector } from '~/modules/tracking/features/validation/domain/detectors/conflictingCriticalActuals.detector'
import { postCompletionTrackingContinuedDetector } from '~/modules/tracking/features/validation/domain/detectors/postCompletionTrackingContinued.detector'
import type { TrackingValidationDetector } from '~/modules/tracking/features/validation/domain/model/trackingValidationDetector'

export const TRACKING_VALIDATION_DETECTORS: readonly TrackingValidationDetector[] = [
  conflictingCriticalActualsDetector,
  postCompletionTrackingContinuedDetector,
]
