import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import type { Timeline } from '~/modules/tracking/features/timeline/domain/model/timeline'
import type { Instant } from '~/shared/time/instant'

export type TrackingValidationPostCarriageMaritimeEventSignal = {
  readonly type: string
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  readonly location: string | null
  readonly hasVesselContext: boolean
  readonly hasVoyageContext: boolean
}

export type TrackingValidationDerivedSignals = {
  readonly canonicalTimeline: {
    readonly postCarriageMaritimeEvents: readonly TrackingValidationPostCarriageMaritimeEventSignal[]
  }
}

export function createEmptyTrackingValidationDerivedSignals(): TrackingValidationDerivedSignals {
  return {
    canonicalTimeline: {
      postCarriageMaritimeEvents: [],
    },
  }
}

export type TrackingValidationContext = {
  readonly containerId: string
  readonly containerNumber: string
  readonly observations: readonly Observation[]
  readonly timeline: Timeline
  readonly status: ContainerStatus
  readonly transshipment: TransshipmentInfo
  readonly signals: TrackingValidationDerivedSignals
  readonly now: Instant
}
