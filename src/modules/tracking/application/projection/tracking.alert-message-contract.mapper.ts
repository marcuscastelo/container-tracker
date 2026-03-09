import type { TrackingAlertMessageContract } from '~/modules/tracking/domain/model/trackingAlert'

export function toTrackingAlertMessageContract(
  alert: TrackingAlertMessageContract,
): TrackingAlertMessageContract {
  switch (alert.message_key) {
    case 'alerts.transshipmentDetected':
      return {
        message_key: alert.message_key,
        message_params: alert.message_params,
      }
    case 'alerts.customsHoldDetected':
      return {
        message_key: alert.message_key,
        message_params: alert.message_params,
      }
    case 'alerts.noMovementDetected':
      return {
        message_key: alert.message_key,
        message_params: alert.message_params,
      }
    case 'alerts.etaMissing':
      return {
        message_key: alert.message_key,
        message_params: alert.message_params,
      }
    case 'alerts.etaPassed':
      return {
        message_key: alert.message_key,
        message_params: alert.message_params,
      }
    case 'alerts.portChange':
      return {
        message_key: alert.message_key,
        message_params: alert.message_params,
      }
    case 'alerts.dataInconsistent':
      return {
        message_key: alert.message_key,
        message_params: alert.message_params,
      }
  }
}
