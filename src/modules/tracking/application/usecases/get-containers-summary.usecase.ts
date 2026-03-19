import {
  createTrackingOperationalSummaryFallback,
  deriveTrackingOperationalSummary,
  type TrackingOperationalSummary,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import { deriveTransshipment } from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import { toTrackingObservationProjections } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import type { Instant } from '~/shared/time/instant'

export type GetContainersSummaryCommand = {
  readonly containers: readonly {
    readonly containerId: string
    readonly containerNumber: string
    readonly podLocationCode?: string | null
  }[]
  readonly now: Instant
}

export async function getContainersSummary(
  deps: TrackingUseCasesDeps,
  cmd: GetContainersSummaryCommand,
): Promise<Map<string, TrackingOperationalSummary>> {
  const summariesByContainerId = new Map<string, TrackingOperationalSummary>()

  await Promise.all(
    cmd.containers.map(async (container) => {
      try {
        const observations = await deps.observationRepository.findAllByContainerId(
          container.containerId,
        )
        const timeline = deriveTimeline(
          container.containerId,
          container.containerNumber,
          observations,
          cmd.now,
        )
        const status = deriveStatus(timeline)
        const transshipment = deriveTransshipment(timeline)

        const summary = deriveTrackingOperationalSummary({
          observations: toTrackingObservationProjections(observations),
          status,
          transshipment,
          podLocationCode: container.podLocationCode ?? null,
          now: cmd.now,
        })

        summariesByContainerId.set(container.containerId, summary)
      } catch (error) {
        console.error('tracking.getContainersSummary.container_failed', {
          containerId: container.containerId,
          containerNumber: container.containerNumber,
          error: error instanceof Error ? error.message : String(error),
        })

        summariesByContainerId.set(
          container.containerId,
          createTrackingOperationalSummaryFallback(true),
        )
      }
    }),
  )

  return summariesByContainerId
}
