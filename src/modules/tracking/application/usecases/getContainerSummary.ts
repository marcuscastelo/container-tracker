import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { ContainerStatus } from '~/modules/tracking/domain/containerStatus'
import { deriveTransshipment } from '~/modules/tracking/domain/deriveAlerts'
import { deriveStatus } from '~/modules/tracking/domain/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/domain/deriveTimeline'
import type { Observation } from '~/modules/tracking/domain/observation'
import type { Timeline } from '~/modules/tracking/domain/timeline'
import type { TrackingAlert } from '~/modules/tracking/domain/trackingAlert'
import type { TransshipmentInfo } from '~/modules/tracking/domain/transshipment'

/**
 * Command to retrieve the full tracking summary for a container.
 */
export type GetContainerSummaryCommand = {
  readonly containerId: string
  readonly containerNumber: string
}

/**
 * Result — all derived tracking data for a single container.
 *
 * This is a formal Result DTO (application boundary contract),
 * NOT a ViewModel. Presenters/UI should transform this as needed.
 */
export type GetContainerSummaryResult = {
  readonly containerId: string
  readonly containerNumber: string
  readonly observations: readonly Observation[]
  readonly timeline: Timeline
  readonly status: ContainerStatus
  readonly transshipment: TransshipmentInfo
  readonly alerts: readonly TrackingAlert[]
}

/**
 * Get the full tracking summary for a container.
 *
 * Fetches observations and active alerts from persistence,
 * then derives timeline, status, and transshipment info.
 */
export async function getContainerSummary(
  deps: TrackingUseCasesDeps,
  cmd: GetContainerSummaryCommand,
): Promise<GetContainerSummaryResult> {
  const [observations, alerts] = await Promise.all([
    deps.observationRepository.findAllByContainerId(cmd.containerId),
    deps.trackingAlertRepository.findActiveByContainerId(cmd.containerId),
  ])

  const timeline = deriveTimeline(cmd.containerId, cmd.containerNumber, observations)
  const status = deriveStatus(timeline)
  const transshipment = deriveTransshipment(timeline)

  return {
    containerId: cmd.containerId,
    containerNumber: cmd.containerNumber,
    observations,
    timeline,
    status,
    transshipment,
    alerts,
  }
}
