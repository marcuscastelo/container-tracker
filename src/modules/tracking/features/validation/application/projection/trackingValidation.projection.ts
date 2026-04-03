import { TRACKING_VALIDATION_DETECTORS } from '~/modules/tracking/features/validation/domain/detectors'
import type { TrackingValidationContext } from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
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

const trackingValidationRegistry = createTrackingValidationRegistry(TRACKING_VALIDATION_DETECTORS)

export type { TrackingValidationContainerSummary, TrackingValidationProcessSummary }

export type TrackingValidationContainerProjection = {
  readonly containerId: string
  readonly containerNumber: string
  readonly findings: readonly TrackingValidationFinding[]
  readonly summary: TrackingValidationContainerSummary
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
