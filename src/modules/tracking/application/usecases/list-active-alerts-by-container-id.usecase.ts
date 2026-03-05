import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { TrackingAlert } from '~/modules/tracking/domain/model/trackingAlert'

/**
 * Command to list active alerts for a container by its ID.
 */
type ListActiveAlertsByContainerIdCommand = {
  readonly containerId: string
}

/**
 * Result — ordered list of active (non-acked, non-dismissed) alerts.
 */
export type ListActiveAlertsByContainerIdResult = {
  readonly alerts: readonly TrackingAlert[]
}

/**
 * List active alerts for a container, without going through the full summary.
 *
 * This avoids the previous pattern of calling getContainerSummary with a
 * fake containerNumber just to retrieve alerts.
 */
export async function listActiveAlertsByContainerId(
  deps: TrackingUseCasesDeps,
  cmd: ListActiveAlertsByContainerIdCommand,
): Promise<ListActiveAlertsByContainerIdResult> {
  const alerts = await deps.trackingAlertRepository.findActiveByContainerId(cmd.containerId)
  return { alerts }
}
