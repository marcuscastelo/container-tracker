export type ReplayTemporalConflict = {
  readonly fingerprintKey: string
  readonly rawEventTime: string | null
  readonly beforeInstant: string | null
  readonly afterInstant: string | null
}

export type ReplayDiffSummary = {
  readonly snapshotCount: number
  readonly currentGenerationId: string | null
  readonly candidateGenerationId: string | null
  readonly observationsCurrentCount: number
  readonly observationsCandidateCount: number
  readonly alertsCurrentCount: number
  readonly alertsCandidateCount: number
  readonly addedObservationFingerprints: readonly string[]
  readonly removedObservationFingerprints: readonly string[]
  readonly statusChanged: boolean
  readonly statusBefore: string | null
  readonly statusAfter: string | null
  readonly alertsChanged: boolean
  readonly potentialTemporalConflicts: readonly ReplayTemporalConflict[]
}

export const EMPTY_REPLAY_DIFF_SUMMARY: ReplayDiffSummary = {
  snapshotCount: 0,
  currentGenerationId: null,
  candidateGenerationId: null,
  observationsCurrentCount: 0,
  observationsCandidateCount: 0,
  alertsCurrentCount: 0,
  alertsCandidateCount: 0,
  addedObservationFingerprints: [],
  removedObservationFingerprints: [],
  statusChanged: false,
  statusBefore: null,
  statusAfter: null,
  alertsChanged: false,
  potentialTemporalConflicts: [],
}
