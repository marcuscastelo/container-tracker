import type { TrackingValidationAffectedScope } from '~/modules/tracking/features/validation/domain/model/trackingValidationAffectedScope'
import {
  compareTrackingValidationSeverity,
  type TrackingValidationSeverity,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationSeverity'

export type TrackingValidationAffectedArea =
  | 'container'
  | 'operational'
  | 'process'
  | 'series'
  | 'status'
  | 'timeline'

export type TrackingValidationDisplayIssue = {
  readonly code: string
  readonly severity: TrackingValidationSeverity
  readonly reasonKey: string
  readonly affectedArea: TrackingValidationAffectedArea
  readonly affectedLocation: string | null
  readonly affectedBlockLabelKey: string | null
}

export function toTrackingValidationAffectedArea(
  scope: TrackingValidationAffectedScope,
): TrackingValidationAffectedArea {
  switch (scope) {
    case 'CONTAINER':
      return 'container'
    case 'OPERATIONAL':
      return 'operational'
    case 'PROCESS':
      return 'process'
    case 'SERIES':
      return 'series'
    case 'STATUS':
      return 'status'
    case 'TIMELINE':
      return 'timeline'
  }
}

export function compareTrackingValidationDisplayIssues(
  left: TrackingValidationDisplayIssue,
  right: TrackingValidationDisplayIssue,
): number {
  const severityCompare = compareTrackingValidationSeverity(right.severity, left.severity)
  if (severityCompare !== 0) {
    return severityCompare
  }

  return left.code.localeCompare(right.code, 'en')
}
