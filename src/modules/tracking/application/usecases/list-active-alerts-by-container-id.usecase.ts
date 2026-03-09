import {
  type TrackingAlertDisplayReadModel,
  toTrackingAlertDisplayReadModels,
} from '~/modules/tracking/application/projection/tracking.alert-display.readmodel'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'

/**
 * Command to list active alerts for a container by its ID.
 */
type ListActiveAlertsByContainerIdCommand = {
  readonly containerId: string
}

/**
 * Result — ordered list of active (non-acked) alerts.
 */
export type ListActiveAlertsByContainerIdResult = {
  readonly alerts: readonly TrackingAlertDisplayReadModel[]
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
  const containerNumberByContainerId = await deps.trackingAlertRepository.findContainerNumbersByIds(
    [cmd.containerId],
  )

  return {
    alerts: toTrackingAlertDisplayReadModels(
      alerts,
      (containerId) => containerNumberByContainerId.get(containerId) ?? null,
    ),
  }
}
