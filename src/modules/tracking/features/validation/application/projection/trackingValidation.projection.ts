import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import { toTrackingObservationProjections } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import { buildTimelineRenderList } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.blocks.readmodel'
import { deriveTimelineWithSeriesReadModel } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import type { Timeline } from '~/modules/tracking/features/timeline/domain/model/timeline'
import { TRACKING_VALIDATION_DETECTORS } from '~/modules/tracking/features/validation/domain/detectors'
import {
  createEmptyTrackingValidationDetectorSignals,
  type TrackingValidationContext,
  type TrackingValidationDetectorSignals,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
import type { TrackingValidationFinding } from '~/modules/tracking/features/validation/domain/model/trackingValidationFinding'
import type {
  TrackingValidationContainerSummary,
  TrackingValidationProcessSummary,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationSummary'
import {
  createEmptyTrackingValidationContainerSummary as createEmptyTrackingValidationContainerSummaryModel,
  createEmptyTrackingValidationProcessSummary as createEmptyTrackingValidationProcessSummaryModel,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationSummary'
import { createTrackingValidationRegistry } from '~/modules/tracking/features/validation/domain/registry/trackingValidationRegistry'
import { aggregateTrackingValidation } from '~/modules/tracking/features/validation/domain/services/aggregateTrackingValidation'
import { deriveTrackingValidation } from '~/modules/tracking/features/validation/domain/services/deriveTrackingValidation'
import type { Instant } from '~/shared/time/instant'

const trackingValidationRegistry = createTrackingValidationRegistry(TRACKING_VALIDATION_DETECTORS)

export type { TrackingValidationContainerSummary, TrackingValidationProcessSummary }

export type TrackingValidationProjectionInput = {
  readonly containerId: string
  readonly containerNumber: string
  readonly observations: readonly Observation[]
  readonly timeline: Timeline
  readonly status: ContainerStatus
  readonly transshipment: TransshipmentInfo
  readonly now: Instant
}

export type TrackingValidationContainerProjection = {
  readonly containerId: string
  readonly containerNumber: string
  readonly findings: readonly TrackingValidationFinding[]
  readonly summary: TrackingValidationContainerSummary
}

function deriveTrackingValidationDetectorSignals(
  context: TrackingValidationProjectionInput,
): TrackingValidationDetectorSignals {
  const timelineItems = deriveTimelineWithSeriesReadModel(
    toTrackingObservationProjections(context.observations),
    context.now,
    { includeSeriesHistory: false },
  )
  const renderList = buildTimelineRenderList(timelineItems, context.now)
  const postCarriageMaritimeEvents = renderList.flatMap((item) => {
    if (item.type !== 'terminal-block' || item.block.kind !== 'post-carriage') {
      return []
    }

    return item.block.events.flatMap((event) => {
      const hasVesselContext = (event.vesselName?.trim().length ?? 0) > 0
      const hasVoyageContext = (event.voyage?.trim().length ?? 0) > 0
      const hasStrongMaritimeType = event.type === 'LOAD' || event.type === 'DEPARTURE'

      if (!hasVesselContext && !hasVoyageContext && !hasStrongMaritimeType) {
        return []
      }

      return [
        {
          type: event.type,
          eventTimeType: event.eventTimeType,
          location: event.location ?? null,
          hasVesselContext,
          hasVoyageContext,
        },
      ]
    })
  })

  if (postCarriageMaritimeEvents.length === 0) {
    return createEmptyTrackingValidationDetectorSignals()
  }

  return {
    canonicalTimeline: {
      postCarriageMaritimeEvents,
    },
  }
}

export function createTrackingValidationContext(
  context: TrackingValidationProjectionInput,
): TrackingValidationContext {
  return {
    ...context,
    derivedSignals: deriveTrackingValidationDetectorSignals(context),
  }
}

function deriveTrackingValidationProjectionFromInput(
  context: TrackingValidationProjectionInput,
): TrackingValidationContainerProjection {
  return deriveTrackingValidationProjection(createTrackingValidationContext(context))
}

export function deriveTrackingValidationProjectionFromState(
  context: TrackingValidationProjectionInput,
): TrackingValidationContainerProjection {
  return deriveTrackingValidationProjectionFromInput(context)
}

export function deriveTrackingValidationSummaryFromState(
  context: TrackingValidationProjectionInput,
): TrackingValidationContainerSummary {
  return deriveTrackingValidationProjectionFromInput(context).summary
}

export function deriveTrackingValidationProjection(
  context: TrackingValidationContext,
): TrackingValidationContainerProjection {
  const derivation = deriveTrackingValidation({
    context,
    registry: trackingValidationRegistry,
  })

  return {
    containerId: context.containerId,
    containerNumber: context.containerNumber,
    findings: derivation.findings,
    summary: derivation.summary,
  }
}

export function aggregateTrackingValidationProjection(
  summaries: readonly TrackingValidationContainerSummary[],
): TrackingValidationProcessSummary {
  return aggregateTrackingValidation(summaries)
}

export function createEmptyTrackingValidationContainerProjectionSummary(): TrackingValidationContainerSummary {
  return createEmptyTrackingValidationContainerSummaryModel()
}

export function createEmptyTrackingValidationProcessProjectionSummary(): TrackingValidationProcessSummary {
  return createEmptyTrackingValidationProcessSummaryModel()
}
