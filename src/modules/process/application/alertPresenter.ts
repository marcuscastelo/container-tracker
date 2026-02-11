import type { AlertDisplay } from '~/modules/process/application/uiTypes'
import type { TrackingAlertResponse } from '~/shared/api-schemas/processes.schemas'

// TODO: Move formatRelativeTime to a shared utility if we need it elsewhere; for now it's only used in alert presentation
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

/**
 * Map TrackingAlertType to AlertDisplay type.
 */
function alertTypeToDisplay(type: string): AlertDisplay['type'] {
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

/**
 * Map TrackingAlertSeverity to AlertDisplay severity.
 */
function alertSeverityToDisplay(severity: string): AlertDisplay['severity'] {
  if (severity === 'warning' || severity === 'danger' || severity === 'info') {
    return severity
  }
  return 'info'
}

/**
 * Convert a TrackingAlertResponse into an AlertDisplay for the UI.
 */
export function alertToDisplay(alert: TrackingAlertResponse): AlertDisplay {
  return {
    id: alert.id,
    type: alertTypeToDisplay(alert.type),
    severity: alertSeverityToDisplay(alert.severity),
    message: alert.message,
    timestamp: formatRelativeTime(alert.triggered_at),
    category: alert.category === 'fact' ? 'fact' : 'monitoring',
    retroactive: alert.retroactive,
  }
}
