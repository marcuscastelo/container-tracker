import { z } from 'zod/v4'
import type { TrackingReplayAdminRepository } from '~/modules/tracking/features/replay/application/ports/tracking-replay-admin.repository'
import type { ReplayRunView } from '~/modules/tracking/features/replay/domain/replay-run'
import { HttpError } from '~/shared/errors/httpErrors'

const ReplayRunIdSchema = z.string().uuid()

export async function getTrackingReplayRun(
  deps: {
    readonly replayAdminRepository: TrackingReplayAdminRepository
  },
  command: {
    readonly runId: string
  },
): Promise<ReplayRunView> {
  const runId = command.runId.trim()
  if (runId.length === 0) {
    throw new HttpError('tracking_replay_run_id_required', 400)
  }

  if (!ReplayRunIdSchema.safeParse(runId).success) {
    throw new HttpError('tracking_replay_run_id_invalid', 400)
  }

  const run = await deps.replayAdminRepository.getRun(runId)
  if (run === null) {
    throw new HttpError('tracking_replay_run_not_found', 404)
  }

  return run
}
