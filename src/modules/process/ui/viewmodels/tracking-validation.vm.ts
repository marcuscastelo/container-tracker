export type TrackingValidationSeverityVM = 'info' | 'warning' | 'danger'

export type ProcessTrackingValidationVM = {
  readonly hasIssues: boolean
  readonly highestSeverity: TrackingValidationSeverityVM | null
  readonly affectedContainerCount: number
}

export type ContainerTrackingValidationVM = {
  readonly hasIssues: boolean
  readonly highestSeverity: TrackingValidationSeverityVM | null
  readonly findingCount: number
}
