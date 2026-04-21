import { randomUUID } from 'node:crypto'
import type { TrackingReplayAdminRepository } from '~/modules/tracking/features/replay/application/ports/tracking-replay-admin.repository'
import type { TrackingReplayLockRepository } from '~/modules/tracking/features/replay/application/ports/tracking-replay-lock.repository'
import { EMPTY_REPLAY_DIFF_SUMMARY } from '~/modules/tracking/features/replay/domain/replay-diff'
import { REPLAY_LOCK_TTL_SECONDS } from '~/modules/tracking/features/replay/domain/replay-lock-policy'
import type { ReplayRollbackResult } from '~/modules/tracking/features/replay/domain/replay-run'
import { HttpError } from '~/shared/errors/httpErrors'
import { systemClock } from '~/shared/time/clock'

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }

  return 'tracking_replay_rollback_failed'
}

export type RollbackTrackingReplayCommand = {
  readonly containerId: string
  readonly reason: string | null
  readonly requestedBy: string
  readonly codeVersion: string | null
}

export async function rollbackTrackingReplay(
  deps: {
    readonly replayAdminRepository: TrackingReplayAdminRepository
    readonly replayLockRepository: TrackingReplayLockRepository
  },
  command: RollbackTrackingReplayCommand,
): Promise<ReplayRollbackResult> {
  const target = await deps.replayAdminRepository.findTargetByContainerId(command.containerId)
  if (target === null) {
    throw new HttpError('tracking_replay_container_not_found', 404)
  }

  const run = await deps.replayAdminRepository.createRun({
    mode: 'ROLLBACK',
    status: 'RUNNING',
    requestedBy: command.requestedBy,
    reason: command.reason,
    codeVersion: command.codeVersion,
  })

  const runTarget = await deps.replayAdminRepository.createRunTarget({
    runId: run.id,
    containerId: target.containerId,
    containerNumber: target.containerNumber,
    provider: target.provider,
    snapshotCount: target.snapshotCount,
    status: 'RUNNING',
  })

  const ownerToken = randomUUID()
  const lockResult = await deps.replayLockRepository.acquire({
    containerId: target.containerId,
    runId: run.id,
    runTargetId: runTarget.id,
    mode: 'ROLLBACK',
    ownerToken,
    ttlSeconds: REPLAY_LOCK_TTL_SECONDS,
  })

  if (!lockResult.acquired) {
    const errorMessage = `tracking_replay_lock_conflict:${target.containerId}`
    const finishedAt = systemClock.now().toIsoString()

    await deps.replayAdminRepository.updateRunTarget({
      runTargetId: runTarget.id,
      status: 'FAILED',
      errorMessage,
      diffSummary: EMPTY_REPLAY_DIFF_SUMMARY,
      createdGenerationId: null,
      lockHeartbeatAt: null,
      lockExpiresAt: lockResult.expiresAt,
    })

    await deps.replayAdminRepository.updateRun({
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
    const pointer = await deps.replayAdminRepository.findGenerationPointer(target.containerId)
    if (pointer === null || pointer.previousGenerationId === null) {
      throw new HttpError('tracking_replay_no_previous_generation_for_rollback', 422)
    }

    const rolledBackPointer = await deps.replayAdminRepository.rollbackGenerationPointer({
      containerId: target.containerId,
      runId: run.id,
      rolledBackAt: systemClock.now().toIsoString(),
    })

    if (rolledBackPointer === null || rolledBackPointer.activeGenerationId === null) {
      throw new HttpError('tracking_replay_no_previous_generation_for_rollback', 422)
    }

    const finishedAt = systemClock.now().toIsoString()

    await deps.replayAdminRepository.updateRunTarget({
      runTargetId: runTarget.id,
      status: 'ROLLED_BACK',
      errorMessage: null,
      diffSummary: EMPTY_REPLAY_DIFF_SUMMARY,
      createdGenerationId: rolledBackPointer.activeGenerationId,
      lockHeartbeatAt: systemClock.now().toIsoString(),
      lockExpiresAt: lockResult.expiresAt,
    })

    await deps.replayAdminRepository.updateRun({
      runId: run.id,
      status: 'ROLLED_BACK',
      errorMessage: null,
      summary: {
        activeGenerationId: rolledBackPointer.activeGenerationId,
        previousGenerationId: rolledBackPointer.previousGenerationId,
      },
      finishedAt,
    })

    return {
      runId: run.id,
      status: 'ROLLED_BACK',
      activeGenerationId: rolledBackPointer.activeGenerationId,
      previousGenerationId: rolledBackPointer.previousGenerationId,
    }
  } catch (error) {
    const errorMessage = toErrorMessage(error)
    const finishedAt = systemClock.now().toIsoString()

    await deps.replayAdminRepository.updateRunTarget({
      runTargetId: runTarget.id,
      status: 'FAILED',
      errorMessage,
      diffSummary: EMPTY_REPLAY_DIFF_SUMMARY,
      createdGenerationId: null,
      lockHeartbeatAt: systemClock.now().toIsoString(),
      lockExpiresAt: null,
    })

    await deps.replayAdminRepository.updateRun({
      runId: run.id,
      status: 'FAILED',
      errorMessage,
      summary: {
        containerId: target.containerId,
      },
      finishedAt,
    })

    throw error
  } finally {
    await deps.replayLockRepository.release({
      containerId: target.containerId,
      runTargetId: runTarget.id,
      ownerToken,
    })
  }
}
