import type {
  ReplayLookupResponse,
  ReplayRunResponse,
} from '~/modules/process/ui/api/internal-tracking-replay.api'
import type {
  TrackingReplayDiffVM,
  TrackingReplayRunVM,
  TrackingReplayTargetVM,
} from '~/modules/process/ui/screens/internal-tracking-replay/trackingReplay.vm'

export function toTrackingReplayTargetVm(target: ReplayLookupResponse): TrackingReplayTargetVM {
  return {
    containerId: target.containerId,
    containerNumber: target.containerNumber,
    provider: target.provider,
    processReference: target.processReference,
    processId: target.processId,
    snapshotCount: target.snapshotCount,
    activeGenerationId: target.activeGenerationId,
    previousGenerationId: target.previousGenerationId,
    lastReplayRun:
      target.lastReplayRun === null
        ? null
        : {
            runId: target.lastReplayRun.runId,
            mode: target.lastReplayRun.mode,
            status: target.lastReplayRun.status,
            createdAt: target.lastReplayRun.createdAt,
          },
  }
}

export function toTrackingReplayRunVm(run: ReplayRunResponse): TrackingReplayRunVM {
  return {
    runId: run.runId,
    status: run.status,
    mode: run.mode,
    requestedBy: run.requestedBy,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    errorMessage: run.errorMessage,
  }
}

export function toTrackingReplayDiffVm(run: ReplayRunResponse): TrackingReplayDiffVM | null {
  const target = run.target
  if (target === null) {
    return null
  }

  return {
    snapshotCount: target.diffSummary.snapshotCount,
    observationsCurrentCount: target.diffSummary.observationsCurrentCount,
    observationsCandidateCount: target.diffSummary.observationsCandidateCount,
    alertsCurrentCount: target.diffSummary.alertsCurrentCount,
    alertsCandidateCount: target.diffSummary.alertsCandidateCount,
    statusBefore: target.diffSummary.statusBefore,
    statusAfter: target.diffSummary.statusAfter,
    statusChanged: target.diffSummary.statusChanged,
    alertsChanged: target.diffSummary.alertsChanged,
    addedObservationFingerprints: [...target.diffSummary.addedObservationFingerprints],
    removedObservationFingerprints: [...target.diffSummary.removedObservationFingerprints],
    potentialTemporalConflicts: target.diffSummary.potentialTemporalConflicts.map((conflict) => ({
      fingerprintKey: conflict.fingerprintKey,
      rawEventTime: conflict.rawEventTime,
      beforeInstant: conflict.beforeInstant,
      afterInstant: conflict.afterInstant,
    })),
    currentGenerationId: target.diffSummary.currentGenerationId,
    candidateGenerationId: target.diffSummary.candidateGenerationId,
  }
}
