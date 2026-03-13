import { acknowledgeTrackingAlertRequest } from '~/modules/process/ui/api/process.api'

export async function acknowledgeShipmentAlert(alertId: string): Promise<void> {
  await acknowledgeTrackingAlertRequest(alertId)
}
