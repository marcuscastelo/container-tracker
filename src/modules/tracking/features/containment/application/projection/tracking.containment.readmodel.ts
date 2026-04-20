import type { TrackingContainmentState } from '~/modules/tracking/features/containment/domain/model/trackingContainment'

export type TrackingContainmentReadModel = {
  readonly active: true
  readonly reasonCode: TrackingContainmentState['reasonCode']
  readonly activatedAt: string
}

export function toTrackingContainmentReadModel(
  state: TrackingContainmentState,
): TrackingContainmentReadModel {
  return {
    active: true,
    reasonCode: state.reasonCode,
    activatedAt: state.activatedAt,
  }
}
