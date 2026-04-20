import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type { ContainerTrackingValidationVM } from '~/modules/process/ui/viewmodels/tracking-review.vm'
import type { TrackingStatusCode } from '~/modules/tracking/features/status/application/projection/tracking.status.projection'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import type { TemporalValueDto } from '~/shared/time/dto'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export type TrackingTimeTravelEtaVM = {
  readonly date: string
  readonly state: 'ACTUAL' | 'ACTIVE_EXPECTED' | 'EXPIRED_EXPECTED'
  readonly tone: 'positive' | 'informative' | 'warning'
  readonly type: string
} | null

export type TrackingTimeTravelCurrentContextVM = {
  readonly locationCode: string | null
  readonly locationDisplay: string | null
  readonly vesselName: string | null
  readonly voyage: string | null
  readonly vesselVisible: boolean
}

export type TrackingTimeTravelNextLocationVM = {
  readonly date: string
  readonly type: string
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  readonly locationCode: string | null
  readonly locationDisplay: string | null
} | null

export type TrackingTimeTravelTransshipmentVM = {
  readonly hasTransshipment: boolean
  readonly count: number
  readonly ports: readonly {
    readonly code: string
    readonly display: string | null
  }[]
}

export type TrackingTimeTravelDiffVM =
  | {
      readonly kind: 'initial'
    }
  | {
      readonly kind: 'comparison'
      readonly statusChanged: boolean
      readonly previousStatusCode: TrackingStatusCode
      readonly currentStatusCode: TrackingStatusCode
      readonly timelineChanged: boolean
      readonly addedTimelineCount: number
      readonly removedTimelineCount: number
      readonly alertsChanged: boolean
      readonly newAlertsCount: number
      readonly resolvedAlertsCount: number
      readonly etaChanged: boolean
      readonly previousEta: TrackingTimeTravelEtaVM
      readonly currentEta: TrackingTimeTravelEtaVM
      readonly actualConflictAppeared: boolean
      readonly actualConflictResolved: boolean
    }

export type TrackingTimeTravelSyncVM = {
  readonly snapshotId: string
  readonly fetchedAtIso: string
  readonly position: number
  readonly statusCode: TrackingStatusCode
  readonly statusVariant: StatusVariant
  readonly timeline: readonly TrackingTimelineItem[]
  readonly alerts: readonly AlertDisplayVM[]
  readonly eta: TrackingTimeTravelEtaVM
  readonly currentContext: TrackingTimeTravelCurrentContextVM
  readonly nextLocation: TrackingTimeTravelNextLocationVM
  readonly transshipment: TrackingTimeTravelTransshipmentVM
  readonly trackingValidation: ContainerTrackingValidationVM
  readonly diff: TrackingTimeTravelDiffVM
  readonly debugAvailable: boolean
}

export type TrackingTimeTravelVM = {
  readonly containerId: string
  readonly containerNumber: string | null
  readonly referenceNowIso: string
  readonly selectedSnapshotId: string | null
  readonly syncCount: number
  readonly syncs: readonly TrackingTimeTravelSyncVM[]
}

export type TrackingReplayDebugStateVM = {
  readonly observations: readonly {
    readonly id: string
    readonly fingerprint: string
    readonly type: string
    readonly carrierLabel: string | null
    readonly eventTime: TemporalValueDto | null
    readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
    readonly locationCode: string | null
    readonly locationDisplay: string | null
    readonly vesselName: string | null
    readonly voyage: string | null
    readonly isEmpty: boolean | null
    readonly confidence: string
    readonly provider: string
    readonly createdFromSnapshotId: string
    readonly retroactive: boolean
    readonly createdAt: string
  }[]
  readonly series: readonly {
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
      readonly seriesLabel: string
      readonly vesselName?: string | null
      readonly voyage?: string | null
      readonly changeKind?: string | null
    }[]
  }[]
  readonly timeline: readonly TrackingTimelineItem[]
  readonly status: TrackingStatusCode
  readonly alerts: readonly AlertDisplayVM[]
}

export type TrackingReplayDebugStepVM = {
  readonly stepIndex: number
  readonly snapshotId: string | null
  readonly observationId: string | null
  readonly stage: 'SNAPSHOT' | 'OBSERVATION' | 'SERIES' | 'TIMELINE' | 'STATUS' | 'ALERT'
  readonly input: unknown
  readonly output: unknown
  readonly timestampIso: string
  readonly state: TrackingReplayDebugStateVM
}

export type TrackingReplayDebugVM = {
  readonly containerId: string
  readonly containerNumber: string | null
  readonly snapshotId: string
  readonly fetchedAtIso: string
  readonly position: number
  readonly referenceNowIso: string
  readonly totalObservations: number
  readonly totalSteps: number
  readonly steps: readonly TrackingReplayDebugStepVM[]
  readonly checkpoint: TrackingTimeTravelSyncVM
}
