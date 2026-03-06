export type TrackingAlertProjectionSource = {
  readonly id: string
  readonly type: string
  readonly severity: string
  readonly message: string
  readonly triggered_at: string
  readonly acked_at: string | null
  readonly category: string
  readonly retroactive: boolean
}

export type TrackingAlertProjection = {
  readonly id: string
  readonly type: 'delay' | 'customs' | 'missing-eta' | 'transshipment' | 'info'
  readonly severity: 'info' | 'warning' | 'danger'
  readonly message: string
  readonly triggeredAtIso: string
  readonly ackedAtIso: string | null
  readonly category: 'fact' | 'monitoring'
  readonly retroactive: boolean
}

function alertTypeToProjection(type: string): TrackingAlertProjection['type'] {
  switch (type) {
    case 'TRANSSHIPMENT':
      return 'transshipment'
    case 'CUSTOMS_HOLD':
      return 'customs'
    case 'ETA_MISSING':
    case 'ETA_PASSED':
      return 'missing-eta'
    case 'NO_MOVEMENT':
      return 'delay'
    default:
      return 'info'
  }
}

function alertSeverityToProjection(severity: string): TrackingAlertProjection['severity'] {
  if (severity === 'warning' || severity === 'danger' || severity === 'info') {
    return severity
  }
  return 'info'
}

export function toTrackingAlertProjection(
  alert: TrackingAlertProjectionSource,
): TrackingAlertProjection {
  return {
    id: alert.id,
    type: alertTypeToProjection(alert.type),
    severity: alertSeverityToProjection(alert.severity),
    message: alert.message,
    triggeredAtIso: alert.triggered_at,
    ackedAtIso: alert.acked_at,
    category: alert.category === 'fact' ? 'fact' : 'monitoring',
    retroactive: alert.retroactive,
  }
}

export function toTrackingAlertProjections(
  alerts: readonly TrackingAlertProjectionSource[],
): readonly TrackingAlertProjection[] {
  return alerts.map(toTrackingAlertProjection)
}
