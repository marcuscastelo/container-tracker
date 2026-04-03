export type TrackingValidationSeverity = 'info' | 'warning' | 'danger'

export function compareTrackingValidationSeverity(
  left: TrackingValidationSeverity,
  right: TrackingValidationSeverity,
): number {
  const severityOrder: Readonly<Record<TrackingValidationSeverity, number>> = {
    danger: 3,
    warning: 2,
    info: 1,
  }

  return severityOrder[left] - severityOrder[right]
}
