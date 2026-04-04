import { canonicalTimelineClassificationInconsistentDetector } from '~/modules/tracking/features/validation/domain/detectors/canonicalTimelineClassificationInconsistent.detector'
import { conflictingCriticalActualsDetector } from '~/modules/tracking/features/validation/domain/detectors/conflictingCriticalActuals.detector'
import { expectedPlanNotReconcilableDetector } from '~/modules/tracking/features/validation/domain/detectors/expectedPlanNotReconcilable.detector'
import { missingCriticalMilestoneWithContradictoryContextDetector } from '~/modules/tracking/features/validation/domain/detectors/missingCriticalMilestoneWithContradictoryContext.detector'
import { postCompletionTrackingContinuedDetector } from '~/modules/tracking/features/validation/domain/detectors/postCompletionTrackingContinued.detector'
import type { TrackingValidationDetector } from '~/modules/tracking/features/validation/domain/model/trackingValidationDetector'

export const TRACKING_VALIDATION_DETECTORS: readonly TrackingValidationDetector[] = [
  conflictingCriticalActualsDetector,
  postCompletionTrackingContinuedDetector,
  canonicalTimelineClassificationInconsistentDetector,
  expectedPlanNotReconcilableDetector,
  missingCriticalMilestoneWithContradictoryContextDetector,
]
