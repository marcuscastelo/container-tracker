export type TrackingValidationSeverityVM = 'info' | 'warning' | 'danger'
export type TrackingValidationAffectedAreaVM =
  | 'container'
  | 'operational'
  | 'process'
  | 'series'
  | 'status'
  | 'timeline'

export type TrackingValidationIssueVM = {
  readonly code: string
  readonly severity: TrackingValidationSeverityVM
  readonly reasonKey: string
  readonly affectedArea: TrackingValidationAffectedAreaVM
  readonly affectedLocation: string | null
  readonly affectedBlockLabelKey: string | null
}

export type ProcessTrackingValidationVM = {
  readonly hasIssues: boolean
  readonly highestSeverity: TrackingValidationSeverityVM | null
  readonly affectedContainerCount: number
  readonly topIssue: TrackingValidationIssueVM | null
}

export type ContainerTrackingValidationVM = {
  readonly hasIssues: boolean
  readonly highestSeverity: TrackingValidationSeverityVM | null
  readonly findingCount: number
  readonly activeIssues: readonly TrackingValidationIssueVM[]
}
