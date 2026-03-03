import { toTrackingObservationDTOs } from '~/modules/tracking/application/projection/tracking.observation.dto'
import {
  deriveTrackingOperationalSummary,
  type TrackingOperationalSummary,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import { deriveTransshipment } from '~/modules/tracking/domain/derive/deriveAlerts'
import { deriveStatus } from '~/modules/tracking/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/domain/derive/deriveTimeline'
import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import type { ContainerStatus } from '~/modules/tracking/domain/model/containerStatus'
import type { Observation } from '~/modules/tracking/domain/model/observation'
import type { Timeline } from '~/modules/tracking/domain/model/timeline'
import type { TrackingAlert } from '~/modules/tracking/domain/model/trackingAlert'

/**
 * Command to retrieve the full tracking summary for a container.
 */
export type GetContainerSummaryCommand = {
  readonly containerId: string
  readonly containerNumber: string
  readonly podLocationCode?: string | null
  readonly now?: Date
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
  readonly operational: TrackingOperationalSummary
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
  const referenceNow = cmd.now ?? new Date()
  const [observations, alerts] = await Promise.all([
    deps.observationRepository.findAllByContainerId(cmd.containerId),
    deps.trackingAlertRepository.findActiveByContainerId(cmd.containerId),
  ])

  const timeline = deriveTimeline(cmd.containerId, cmd.containerNumber, observations, referenceNow)
  const status = deriveStatus(timeline)
  const transshipment = deriveTransshipment(timeline)
  const operational = deriveTrackingOperationalSummary({
    observations: toTrackingObservationDTOs(observations),
    status,
    transshipment,
    podLocationCode: cmd.podLocationCode ?? null,
    now: referenceNow,
  })

  return {
    containerId: cmd.containerId,
    containerNumber: cmd.containerNumber,
    observations,
    timeline,
    status,
    transshipment,
    alerts,
    operational,
  }
}
