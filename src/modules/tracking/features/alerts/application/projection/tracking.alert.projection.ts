import type {
  TrackingAlert,
  TrackingAlertMessageContract,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'

type TrackingAlertProjectionSourceBase = {
  readonly id: string
  readonly container_number: string
  readonly type: string
  readonly severity: string
  readonly triggered_at: string
  readonly acked_at: string | null
  readonly category: string
  readonly retroactive: boolean
}

export type TrackingAlertProjectionSource = TrackingAlertProjectionSourceBase &
  TrackingAlertMessageContract

export type TrackingAlertProjection = {
  readonly id: string
  readonly containerNumber: string
  readonly type: 'delay' | 'customs' | 'missing-eta' | 'transshipment' | 'info'
  readonly severity: 'info' | 'warning' | 'danger'
  readonly messageKey:
    | 'alerts.transshipmentDetected'
    | 'alerts.customsHoldDetected'
    | 'alerts.noMovementDetected'
    | 'alerts.etaMissing'
    | 'alerts.etaPassed'
    | 'alerts.portChange'
    | 'alerts.dataInconsistent'
  readonly messageParams: Record<string, string | number>
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

function toProjectionMessageParams(
  params: TrackingAlert['message_params'],
): TrackingAlertProjection['messageParams'] {
  const mapped: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' || typeof value === 'number') {
      mapped[key] = value
    }
  }
  return mapped
}

export function toTrackingAlertProjection(
  alert: TrackingAlertProjectionSource,
): TrackingAlertProjection {
  return {
    id: alert.id,
    containerNumber: alert.container_number,
    type: alertTypeToProjection(alert.type),
    severity: alertSeverityToProjection(alert.severity),
    messageKey: alert.message_key,
    messageParams: toProjectionMessageParams(alert.message_params),
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
