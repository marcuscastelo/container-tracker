import { unacknowledgeTrackingAlertRequest } from '~/modules/process/ui/api/process.api'

export async function unacknowledgeShipmentAlert(alertId: string): Promise<void> {
  await unacknowledgeTrackingAlertRequest(alertId)
}
