import { acknowledgeTrackingAlertRequest } from '~/modules/process/ui/validation/processApi.validation'

export async function acknowledgeShipmentAlert(alertId: string): Promise<void> {
  await acknowledgeTrackingAlertRequest(alertId)
}
