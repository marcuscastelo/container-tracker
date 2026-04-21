import type {
  ReplayRollbackResult,
  ReplayRunExecutionResult,
  ReplayRunTarget,
  ReplayRunView,
  ReplayTargetLookup,
} from '~/modules/tracking/features/replay/domain/replay-run'
import type {
  ReplayLookupResponse,
  ReplayRollbackResponse,
  ReplayRunResponse,
} from '~/modules/tracking/interface/http/internal-replay.schemas'

export function toReplayLookupResponse(target: ReplayTargetLookup): ReplayLookupResponse {
  return {
    containerId: target.containerId,
    containerNumber: target.containerNumber,
    provider: target.provider,
    processId: target.processId,
    processReference: target.processReference,
    snapshotCount: target.snapshotCount,
    activeGenerationId: target.activeGenerationId,
    previousGenerationId: target.previousGenerationId,
    lastReplayRun: target.lastReplayRun,
  }
}

export function toReplayRunResponse(run: ReplayRunView): ReplayRunResponse {
  const target = run.target === null ? null : toReplayRunTarget(run.target)

  return {
    runId: run.runId,
    mode: run.mode,
    status: run.status,
    requestedBy: run.requestedBy,
    reason: run.reason,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    codeVersion: run.codeVersion,
    errorMessage: run.errorMessage,
    summary: run.summary,
    target,
  }
}

function toReplayRunTarget(target: ReplayRunTarget): ReplayRunResponse['target'] {
  return {
    targetId: target.targetId,
    containerId: target.containerId,
    containerNumber: target.containerNumber,
    provider: target.provider,
    snapshotCount: target.snapshotCount,
    status: target.status,
    errorMessage: target.errorMessage,
    diffSummary: {
      snapshotCount: target.diffSummary.snapshotCount,
      currentGenerationId: target.diffSummary.currentGenerationId,
      candidateGenerationId: target.diffSummary.candidateGenerationId,
      observationsCurrentCount: target.diffSummary.observationsCurrentCount,
      observationsCandidateCount: target.diffSummary.observationsCandidateCount,
      alertsCurrentCount: target.diffSummary.alertsCurrentCount,
      alertsCandidateCount: target.diffSummary.alertsCandidateCount,
      addedObservationFingerprints: [...target.diffSummary.addedObservationFingerprints],
      removedObservationFingerprints: [...target.diffSummary.removedObservationFingerprints],
      statusChanged: target.diffSummary.statusChanged,
      statusBefore: target.diffSummary.statusBefore,
      statusAfter: target.diffSummary.statusAfter,
      alertsChanged: target.diffSummary.alertsChanged,
      potentialTemporalConflicts: target.diffSummary.potentialTemporalConflicts.map((conflict) => ({
        fingerprintKey: conflict.fingerprintKey,
        rawEventTime: conflict.rawEventTime,
        beforeInstant: conflict.beforeInstant,
        afterInstant: conflict.afterInstant,
      })),
    },
    createdGenerationId: target.createdGenerationId,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
  }
}

export function toReplayRunExecutionResponse(result: ReplayRunExecutionResult): ReplayRunResponse {
  return toReplayRunResponse(result.run)
}

export function toReplayRollbackResponse(result: ReplayRollbackResult): ReplayRollbackResponse {
  return {
    runId: result.runId,
    status: result.status,
    activeGenerationId: result.activeGenerationId,
    previousGenerationId: result.previousGenerationId,
  }
}
