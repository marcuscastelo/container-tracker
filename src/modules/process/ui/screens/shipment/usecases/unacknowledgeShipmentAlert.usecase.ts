import { unacknowledgeTrackingAlertRequest } from '~/modules/process/ui/validation/processApi.validation'

export async function unacknowledgeShipmentAlert(alertId: string): Promise<void> {
  await unacknowledgeTrackingAlertRequest(alertId)
}
