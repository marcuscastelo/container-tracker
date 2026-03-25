import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import { runTrackingReplay } from '~/modules/tracking/features/replay/application/run-tracking-replay.usecase'
import type { TrackingReplayDebugResult } from '~/modules/tracking/features/replay/application/tracking.replay.types'
import { buildTrackingTimeTravelReadModel } from '~/modules/tracking/features/replay/application/tracking-time-travel.readmodel'
import { HttpError } from '~/shared/errors/httpErrors'
import type { Instant } from '~/shared/time/instant'

export type GetTrackingReplayDebugCommand = {
  readonly containerId: string
  readonly snapshotId: string
  readonly now?: Instant
}

export async function getTrackingReplayDebug(
  deps: TrackingUseCasesDeps,
  command: GetTrackingReplayDebugCommand,
): Promise<TrackingReplayDebugResult> {
  const run = await runTrackingReplay(deps, {
    containerId: command.containerId,
    stopAfterSnapshotId: command.snapshotId,
    ...(command.now === undefined ? {} : { now: command.now }),
  })
  const timeTravel = buildTrackingTimeTravelReadModel(run)
  const checkpoint = timeTravel.syncs.find((entry) => entry.snapshotId === command.snapshotId)
  if (!checkpoint) {
    throw new HttpError('Replay snapshot not found', 404)
  }

  const snapshotSteps = run.steps.filter((step) => step.snapshotId === command.snapshotId)

  return {
    containerId: run.containerId,
    containerNumber: run.containerNumber,
    snapshotId: checkpoint.snapshotId,
    fetchedAt: checkpoint.fetchedAt,
    position: checkpoint.position,
    referenceNow: run.referenceNow,
    totalObservations: run.finalState.observations.length,
    totalSteps: snapshotSteps.length,
    steps: snapshotSteps,
    checkpoint,
  }
}
