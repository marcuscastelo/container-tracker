import { randomUUID } from 'node:crypto'
import type { TrackingReplayAdminRepository } from '~/modules/tracking/features/replay/application/ports/tracking-replay-admin.repository'
import type { TrackingReplayLockRepository } from '~/modules/tracking/features/replay/application/ports/tracking-replay-lock.repository'
import { computeReplayDiffSummary } from '~/modules/tracking/features/replay/application/services/compute-replay-diff-summary.service'
import { executeContainerReplay } from '~/modules/tracking/features/replay/application/services/execute-container-replay.service'
import { EMPTY_REPLAY_DIFF_SUMMARY } from '~/modules/tracking/features/replay/domain/replay-diff'
import { REPLAY_LOCK_TTL_SECONDS } from '~/modules/tracking/features/replay/domain/replay-lock-policy'
import type { ReplayRunExecutionResult } from '~/modules/tracking/features/replay/domain/replay-run'
import type {
  ReplayMode,
  ReplayRunStatus,
} from '~/modules/tracking/features/replay/domain/replay-status'
import { HttpError } from '~/shared/errors/httpErrors'
import { systemClock } from '~/shared/time/clock'
import { Instant } from '~/shared/time/instant'

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }

  return 'tracking_replay_failed'
}

function assertReplayCandidateForApply(command: {
  readonly observationsCount: number
  readonly snapshotCount: number
  readonly hasCandidateGenerationId: boolean
}): void {
  if (command.snapshotCount === 0) {
    throw new HttpError('tracking_replay_no_snapshots', 422)
  }

  if (command.observationsCount === 0) {
    throw new HttpError('tracking_replay_candidate_has_no_observations', 422)
  }

  if (!command.hasCandidateGenerationId) {
    throw new HttpError('tracking_replay_candidate_generation_missing', 500)
  }
}

export async function runAdminTrackingReplay(command: {
  readonly repository: TrackingReplayAdminRepository
  readonly lockRepository: TrackingReplayLockRepository
  readonly mode: Exclude<ReplayMode, 'ROLLBACK'>
  readonly containerId: string
  readonly reason: string | null
  readonly requestedBy: string
  readonly codeVersion: string | null
}): Promise<ReplayRunExecutionResult> {
  const target = await command.repository.findTargetByContainerId(command.containerId)
  if (target === null) {
    throw new HttpError('tracking_replay_container_not_found', 404)
  }

  const run = await command.repository.createRun({
    mode: command.mode,
    status: 'RUNNING',
    requestedBy: command.requestedBy,
    reason: command.reason,
    codeVersion: command.codeVersion,
  })

  const runTarget = await command.repository.createRunTarget({
    runId: run.id,
    containerId: target.containerId,
    containerNumber: target.containerNumber,
    provider: target.provider,
    snapshotCount: target.snapshotCount,
    status: 'RUNNING',
  })

  const ownerToken = randomUUID()

  const lockResult = await command.lockRepository.acquire({
    containerId: target.containerId,
    runId: run.id,
    runTargetId: runTarget.id,
    mode: command.mode,
    ownerToken,
    ttlSeconds: REPLAY_LOCK_TTL_SECONDS,
  })

  if (!lockResult.acquired) {
    const errorMessage = `tracking_replay_lock_conflict:${target.containerId}`
    const finishedAt = systemClock.now().toIsoString()

    await command.repository.updateRunTarget({
      runTargetId: runTarget.id,
      status: 'FAILED',
      errorMessage,
      diffSummary: EMPTY_REPLAY_DIFF_SUMMARY,
      createdGenerationId: null,
      lockHeartbeatAt: null,
      lockExpiresAt: lockResult.expiresAt,
    })

    await command.repository.updateRun({
      runId: run.id,
      status: 'FAILED',
      errorMessage,
      summary: {
        lockOwnerRunTargetId: lockResult.lockOwnerRunTargetId,
      },
      finishedAt,
    })

    throw new HttpError(errorMessage, 409)
  }

  try {
    const snapshots = await command.repository.listSnapshotsForReplay(target.containerId)
    if (snapshots.length === 0) {
      throw new HttpError('tracking_replay_no_snapshots', 422)
    }

    const candidateGeneration = await command.repository.createGeneration({
      containerId: target.containerId,
      sourceKind: 'REPLAY',
      sourceRunId: run.id,
      metadata: {
        mode: command.mode,
      },
    })

    const replayResult = await executeContainerReplay({
      containerId: target.containerId,
      containerNumber: target.containerNumber,
      snapshots,
      onHeartbeat: async () => {
        const heartbeatNow = systemClock.now().toIsoString()
        const heartbeatOk = await command.lockRepository.heartbeat({
          containerId: target.containerId,
          runTargetId: runTarget.id,
          ownerToken,
          ttlSeconds: REPLAY_LOCK_TTL_SECONDS,
        })

        if (!heartbeatOk) {
          throw new HttpError('tracking_replay_lock_lost', 409)
        }

        await command.repository.updateRunTarget({
          runTargetId: runTarget.id,
          status: 'RUNNING',
          errorMessage: null,
          lockHeartbeatAt: heartbeatNow,
          lockExpiresAt: Instant.fromEpochMs(
            systemClock.now().toEpochMs() + REPLAY_LOCK_TTL_SECONDS * 1000,
          ).toIsoString(),
        })
      },
    })

    await command.repository.persistGenerationDerivations({
      containerId: target.containerId,
      generationId: candidateGeneration.id,
      observations: replayResult.observations,
      alerts: replayResult.alerts,
    })

    const generationPointer = await command.repository.findGenerationPointer(target.containerId)
    const currentGenerationId = generationPointer?.activeGenerationId ?? null

    const currentObservations =
      currentGenerationId === null
        ? []
        : await command.repository.listObservationsByGeneration({
            containerId: target.containerId,
            generationId: currentGenerationId,
          })

    const currentAlerts =
      currentGenerationId === null
        ? []
        : await command.repository.listAlertsByGeneration({
            containerId: target.containerId,
            generationId: currentGenerationId,
          })

    const diffSummary = computeReplayDiffSummary({
      containerId: target.containerId,
      containerNumber: target.containerNumber,
      snapshotCount: replayResult.snapshots.length,
      currentGenerationId,
      candidateGenerationId: candidateGeneration.id,
      currentObservations,
      candidateObservations: replayResult.observations,
      currentAlerts,
      candidateAlerts: replayResult.alerts,
    })

    let runStatus: ReplayRunStatus = 'SUCCEEDED'
    let runTargetStatus: ReplayRunStatus = 'SUCCEEDED'

    if (command.mode === 'APPLY') {
      assertReplayCandidateForApply({
        observationsCount: replayResult.observations.length,
        snapshotCount: replayResult.snapshots.length,
        hasCandidateGenerationId: candidateGeneration.id.length > 0,
      })

      await command.repository.activateGenerationPointer({
        containerId: target.containerId,
        nextActiveGenerationId: candidateGeneration.id,
        runId: run.id,
        activatedAt: systemClock.now().toIsoString(),
      })

      runStatus = 'APPLIED'
      runTargetStatus = 'APPLIED'
    }

    const finishedAt = systemClock.now().toIsoString()

    await command.repository.updateRunTarget({
      runTargetId: runTarget.id,
      status: runTargetStatus,
      errorMessage: null,
      diffSummary,
      createdGenerationId: candidateGeneration.id,
      lockHeartbeatAt: systemClock.now().toIsoString(),
      lockExpiresAt: lockResult.expiresAt,
    })

    await command.repository.updateRun({
      runId: run.id,
      status: runStatus,
      errorMessage: null,
      summary: {
        containerId: target.containerId,
        containerNumber: target.containerNumber,
        snapshotCount: replayResult.snapshots.length,
        candidateGenerationId: candidateGeneration.id,
      },
      finishedAt,
    })

    const runView = await command.repository.getRun(run.id)
    if (runView === null) {
      throw new HttpError('tracking_replay_run_not_found_after_execution', 500)
    }

    return {
      run: runView,
    }
  } catch (error) {
    const errorMessage = toErrorMessage(error)
    const finishedAt = systemClock.now().toIsoString()

    await command.repository.updateRunTarget({
      runTargetId: runTarget.id,
      status: 'FAILED',
      errorMessage,
      diffSummary: EMPTY_REPLAY_DIFF_SUMMARY,
      createdGenerationId: null,
      lockHeartbeatAt: systemClock.now().toIsoString(),
      lockExpiresAt: null,
    })

    await command.repository.updateRun({
      runId: run.id,
      status: 'FAILED',
      errorMessage,
      summary: {
        containerId: target.containerId,
        containerNumber: target.containerNumber,
      },
      finishedAt,
    })

    throw error
  } finally {
    await command.lockRepository.release({
      containerId: target.containerId,
      runTargetId: runTarget.id,
      ownerToken,
    })
  }
}
