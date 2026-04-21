export type TrackingReplayViewState = 'loading' | 'empty' | 'error' | 'ready'

export type TrackingReplayTargetVM = {
  readonly containerId: string
  readonly containerNumber: string
  readonly provider: string | null
  readonly processReference: string | null
  readonly processId: string | null
  readonly snapshotCount: number
  readonly activeGenerationId: string | null
  readonly previousGenerationId: string | null
  readonly lastReplayRun: {
    readonly runId: string
    readonly mode: string
    readonly status: string
    readonly createdAt: string
  } | null
}

export type TrackingReplayRunVM = {
  readonly runId: string
  readonly status: string
  readonly mode: string
  readonly requestedBy: string
  readonly createdAt: string
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly errorMessage: string | null
}

export type TrackingReplayDiffTemporalConflictVM = {
  readonly fingerprintKey: string
  readonly rawEventTime: string | null
  readonly beforeInstant: string | null
  readonly afterInstant: string | null
}

export type TrackingReplayDiffVM = {
  readonly snapshotCount: number
  readonly observationsCurrentCount: number
  readonly observationsCandidateCount: number
  readonly alertsCurrentCount: number
  readonly alertsCandidateCount: number
  readonly statusBefore: string | null
  readonly statusAfter: string | null
  readonly statusChanged: boolean
  readonly alertsChanged: boolean
  readonly addedObservationFingerprints: readonly string[]
  readonly removedObservationFingerprints: readonly string[]
  readonly potentialTemporalConflicts: readonly TrackingReplayDiffTemporalConflictVM[]
  readonly currentGenerationId: string | null
  readonly candidateGenerationId: string | null
}
