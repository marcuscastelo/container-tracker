import type { TrackingValidationSeverity } from '~/modules/tracking/features/validation/domain/model/trackingValidationSeverity'
import {
  createEmptyTrackingValidationProcessSummary,
  pickHighestTrackingValidationSeverity,
  type TrackingValidationContainerSummary,
  type TrackingValidationProcessSummary,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationSummary'

export function aggregateTrackingValidation(
  summaries: readonly TrackingValidationContainerSummary[],
): TrackingValidationProcessSummary {
  if (summaries.length === 0) {
    return createEmptyTrackingValidationProcessSummary()
  }

  let affectedContainerCount = 0
  let totalFindingCount = 0
  let highestSeverity: TrackingValidationSeverity | null = null

  for (const summary of summaries) {
    if (!summary.hasIssues) continue

    affectedContainerCount += 1
    totalFindingCount += summary.findingCount
    if (summary.highestSeverity !== null) {
      highestSeverity = pickHighestTrackingValidationSeverity(
        highestSeverity,
        summary.highestSeverity,
      )
    }
  }

  if (affectedContainerCount === 0) {
    return createEmptyTrackingValidationProcessSummary()
  }

  return {
    hasIssues: true,
    affectedContainerCount,
    totalFindingCount,
    highestSeverity,
  }
}
