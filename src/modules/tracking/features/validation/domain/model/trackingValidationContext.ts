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

export type TrackingValidationCanonicalTimelineDuplicatedMilestoneType =
  | 'LOAD'
  | 'DEPARTURE'
  | 'ARRIVAL'
  | 'DISCHARGE'

export type TrackingValidationCanonicalTimelineSegmentDuplicatedMilestoneSignal = {
  readonly type: TrackingValidationCanonicalTimelineDuplicatedMilestoneType
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  readonly location: string
  readonly timelineItemIds: readonly string[]
}

export type TrackingValidationCanonicalTimelineSegmentDuplicatedBlockSignal = {
  readonly order: number
  readonly origin: string | null
  readonly destination: string | null
  readonly timelineItemIds: readonly string[]
}

export type TrackingValidationCanonicalTimelineSegmentDuplicatedSignal = {
  readonly vessel: string
  readonly voyage: string
  readonly identityKey: string
  readonly blocks: readonly TrackingValidationCanonicalTimelineSegmentDuplicatedBlockSignal[]
  readonly repeatedMilestones: readonly TrackingValidationCanonicalTimelineSegmentDuplicatedMilestoneSignal[]
  readonly includesLatestVoyageBlock: boolean
}

export type TrackingValidationDetectorSignals = {
  readonly canonicalTimeline: {
    readonly postCarriageMaritimeEvents: readonly TrackingValidationPostCarriageMaritimeEventSignal[]
    readonly duplicatedSegments: readonly TrackingValidationCanonicalTimelineSegmentDuplicatedSignal[]
  }
}

export function createEmptyTrackingValidationDetectorSignals(): TrackingValidationDetectorSignals {
  return {
    canonicalTimeline: {
      postCarriageMaritimeEvents: [],
      duplicatedSegments: [],
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
  readonly derivedSignals: TrackingValidationDetectorSignals
  readonly now: Instant
}
