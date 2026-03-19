import type { TrackingOperationalEta } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { SeriesLabel } from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { HttpError } from '~/shared/errors/httpErrors'
import type { TemporalValueDto } from '~/shared/time/dto'
import type { Instant } from '~/shared/time/instant'

export const MAX_TRACKING_REPLAY_STEPS = 5000

export class TrackingReplayStepLimitError extends HttpError {
  constructor(message: string) {
    super(message, 422)
    this.name = 'TrackingReplayStepLimitError'
  }
}

export type TrackingReplayStage =
  | 'SNAPSHOT'
  | 'OBSERVATION'
  | 'SERIES'
  | 'TIMELINE'
  | 'STATUS'
  | 'ALERT'

export type TrackingReplaySeries = {
  readonly key: string
  readonly primary: {
    readonly id: string
    readonly type: string
    readonly eventTime: TemporalValueDto | null
    readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  }
  readonly hasActualConflict: boolean
  readonly items: readonly {
    readonly id: string
    readonly type: string
    readonly eventTime: TemporalValueDto | null
    readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
    readonly createdAt: string
    readonly seriesLabel: SeriesLabel
  }[]
}

export type TrackingReplayState = {
  readonly observations: readonly Observation[]
  readonly series: readonly TrackingReplaySeries[]
  readonly timeline: readonly TrackingTimelineItem[]
  readonly status: ContainerStatus
  readonly alerts: readonly TrackingAlert[]
}

export type TrackingReplayStep = {
  readonly stepIndex: number
  readonly snapshotId: string | null
  readonly observationId: string | null
  readonly stage: TrackingReplayStage
  readonly input: unknown
  readonly output: unknown
  readonly timestamp: string
  readonly state: TrackingReplayState
}

export type TrackingReplayRunCheckpoint = {
  readonly snapshotId: string
  readonly fetchedAt: string
  readonly position: number
  readonly containerNumber: string | null
  readonly state: TrackingReplayState
}

export type TrackingReplayRunResult = {
  readonly containerId: string
  readonly containerNumber: string | null
  readonly referenceNow: string
  readonly totalSnapshots: number
  readonly totalObservations: number
  readonly totalSteps: number
  readonly steps: readonly TrackingReplayStep[]
  readonly checkpoints: readonly TrackingReplayRunCheckpoint[]
  readonly finalState: TrackingReplayState
}

export type RunTrackingReplayCommand = {
  readonly containerId: string
  readonly now?: Instant
  readonly stopAfterSnapshotId?: string
  readonly recordSteps?: boolean
}

export type TrackingTimeTravelDiff =
  | {
      readonly kind: 'initial'
    }
  | {
      readonly kind: 'comparison'
      readonly statusChanged: boolean
      readonly previousStatus: ContainerStatus
      readonly currentStatus: ContainerStatus
      readonly timelineChanged: boolean
      readonly addedTimelineItemIds: readonly string[]
      readonly removedTimelineItemIds: readonly string[]
      readonly alertsChanged: boolean
      readonly newAlertFingerprints: readonly string[]
      readonly resolvedAlertFingerprints: readonly string[]
      readonly etaChanged: boolean
      readonly previousEta: TrackingOperationalEta | null
      readonly currentEta: TrackingOperationalEta | null
      readonly actualConflictAppeared: boolean
      readonly actualConflictResolved: boolean
    }

export type TrackingTimeTravelCheckpoint = {
  readonly snapshotId: string
  readonly fetchedAt: string
  readonly position: number
  readonly timeline: readonly TrackingTimelineItem[]
  readonly status: ContainerStatus
  readonly alerts: readonly TrackingAlert[]
  readonly eta: TrackingOperationalEta | null
  readonly diffFromPrevious: TrackingTimeTravelDiff
  readonly debugAvailable: true
}

export type TrackingTimeTravelResult = {
  readonly containerId: string
  readonly containerNumber: string | null
  readonly referenceNow: string
  readonly selectedSnapshotId: string | null
  readonly syncCount: number
  readonly syncs: readonly TrackingTimeTravelCheckpoint[]
}

export type TrackingReplayDebugResult = {
  readonly containerId: string
  readonly containerNumber: string | null
  readonly snapshotId: string
  readonly fetchedAt: string
  readonly position: number
  readonly referenceNow: string
  readonly totalObservations: number
  readonly totalSteps: number
  readonly steps: readonly TrackingReplayStep[]
  readonly checkpoint: TrackingTimeTravelCheckpoint
}
