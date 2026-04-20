import {
  compareTrackingValidationSeverity,
  type TrackingValidationSeverity,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationSeverity'

export type TrackingValidationContainerSummary = {
  readonly hasIssues: boolean
  readonly findingCount: number
  readonly highestSeverity: TrackingValidationSeverity | null
}

export type TrackingValidationProcessSummary = {
  readonly hasIssues: boolean
  readonly affectedContainerCount: number
  readonly totalFindingCount: number
  readonly highestSeverity: TrackingValidationSeverity | null
}

export function createEmptyTrackingValidationContainerSummary(): TrackingValidationContainerSummary {
  return {
    hasIssues: false,
    findingCount: 0,
    highestSeverity: null,
  }
}

export function createEmptyTrackingValidationProcessSummary(): TrackingValidationProcessSummary {
  return {
    hasIssues: false,
    affectedContainerCount: 0,
    totalFindingCount: 0,
    highestSeverity: null,
  }
}

export function pickHighestTrackingValidationSeverity(
  current: TrackingValidationSeverity | null,
  candidate: TrackingValidationSeverity,
): TrackingValidationSeverity {
  if (current === null) return candidate
  return compareTrackingValidationSeverity(candidate, current) > 0 ? candidate : current
}
