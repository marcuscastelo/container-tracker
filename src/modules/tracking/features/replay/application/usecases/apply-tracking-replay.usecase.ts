import type { TrackingReplayAdminRepository } from '~/modules/tracking/features/replay/application/ports/tracking-replay-admin.repository'
import type { TrackingReplayLockRepository } from '~/modules/tracking/features/replay/application/ports/tracking-replay-lock.repository'
import { runAdminTrackingReplay } from '~/modules/tracking/features/replay/application/services/run-admin-tracking-replay.service'
import type { ReplayRunExecutionResult } from '~/modules/tracking/features/replay/domain/replay-run'

export type ApplyTrackingReplayCommand = {
  readonly containerId: string
  readonly reason: string | null
  readonly requestedBy: string
  readonly codeVersion: string | null
}

export async function applyTrackingReplay(
  deps: {
    readonly replayAdminRepository: TrackingReplayAdminRepository
    readonly replayLockRepository: TrackingReplayLockRepository
  },
  command: ApplyTrackingReplayCommand,
): Promise<ReplayRunExecutionResult> {
  return runAdminTrackingReplay({
    repository: deps.replayAdminRepository,
    lockRepository: deps.replayLockRepository,
    mode: 'APPLY',
    containerId: command.containerId,
    reason: command.reason,
    requestedBy: command.requestedBy,
    codeVersion: command.codeVersion,
  })
}
