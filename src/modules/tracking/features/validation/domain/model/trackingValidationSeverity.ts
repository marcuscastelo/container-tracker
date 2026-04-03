export type TrackingValidationSeverity = 'ADVISORY' | 'CRITICAL'

export function compareTrackingValidationSeverity(
  left: TrackingValidationSeverity,
  right: TrackingValidationSeverity,
): number {
  const severityOrder: Readonly<Record<TrackingValidationSeverity, number>> = {
    CRITICAL: 2,
    ADVISORY: 1,
  }

  return severityOrder[left] - severityOrder[right]
}
