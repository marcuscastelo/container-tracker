import type {
  NavbarAlertItemReadModel,
  NavbarAlertMessageContract,
} from '~/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel.shared'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'

function isTransshipmentParams(
  params: TrackingActiveAlertReadModel['message_params'],
): params is Extract<
  NavbarAlertMessageContract,
  { messageKey: 'alerts.transshipmentDetected' }
>['messageParams'] {
  return (
    typeof params === 'object' &&
    params !== null &&
    'port' in params &&
    typeof params.port === 'string' &&
    'fromVessel' in params &&
    typeof params.fromVessel === 'string' &&
    'toVessel' in params &&
    typeof params.toVessel === 'string'
  )
}

function isCustomsHoldParams(
  params: TrackingActiveAlertReadModel['message_params'],
): params is Extract<
  NavbarAlertMessageContract,
  { messageKey: 'alerts.customsHoldDetected' }
>['messageParams'] {
  return (
    typeof params === 'object' &&
    params !== null &&
    'location' in params &&
    typeof params.location === 'string'
  )
}

function isNoMovementParams(
  params: TrackingActiveAlertReadModel['message_params'],
): params is Extract<
  NavbarAlertMessageContract,
  { messageKey: 'alerts.noMovementDetected' }
>['messageParams'] {
  return (
    typeof params === 'object' &&
    params !== null &&
    'threshold_days' in params &&
    typeof params.threshold_days === 'number' &&
    'days_without_movement' in params &&
    typeof params.days_without_movement === 'number' &&
    'days' in params &&
    typeof params.days === 'number' &&
    'lastEventDate' in params &&
    typeof params.lastEventDate === 'string'
  )
}

export function toAlertItemReadModel(
  alert: TrackingActiveAlertReadModel,
): NavbarAlertItemReadModel {
  const baseAlert = {
    alertId: alert.alert_id,
    severity: alert.severity,
    category: alert.category,
    occurredAt: alert.generated_at,
    retroactive: alert.retroactive,
  }

  switch (alert.message_key) {
    case 'alerts.transshipmentDetected':
      if (!isTransshipmentParams(alert.message_params)) {
        return {
          ...baseAlert,
          messageKey: 'alerts.dataInconsistent',
          messageParams: {},
        }
      }
      return {
        ...baseAlert,
        messageKey: alert.message_key,
        messageParams: alert.message_params,
      }
    case 'alerts.customsHoldDetected':
      if (!isCustomsHoldParams(alert.message_params)) {
        return {
          ...baseAlert,
          messageKey: 'alerts.dataInconsistent',
          messageParams: {},
        }
      }
      return {
        ...baseAlert,
        messageKey: alert.message_key,
        messageParams: alert.message_params,
      }
    case 'alerts.noMovementDetected':
      if (!isNoMovementParams(alert.message_params)) {
        return {
          ...baseAlert,
          messageKey: 'alerts.dataInconsistent',
          messageParams: {},
        }
      }
      return {
        ...baseAlert,
        messageKey: alert.message_key,
        messageParams: alert.message_params,
      }
    case 'alerts.etaMissing':
      return {
        ...baseAlert,
        messageKey: 'alerts.etaMissing',
        messageParams: {},
      }
    case 'alerts.etaPassed':
      return {
        ...baseAlert,
        messageKey: 'alerts.etaPassed',
        messageParams: {},
      }
    case 'alerts.portChange':
      return {
        ...baseAlert,
        messageKey: 'alerts.portChange',
        messageParams: {},
      }
    case 'alerts.dataInconsistent':
      return {
        ...baseAlert,
        messageKey: 'alerts.dataInconsistent',
        messageParams: {},
      }
  }
}
