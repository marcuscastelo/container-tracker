import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import { runTrackingReplay } from '~/modules/tracking/features/replay/application/run-tracking-replay.usecase'
import type { TrackingTimeTravelResult } from '~/modules/tracking/features/replay/application/tracking.replay.types'
import { buildTrackingTimeTravelReadModel } from '~/modules/tracking/features/replay/application/tracking-time-travel.readmodel'

export type GetTrackingTimeTravelCommand = {
  readonly containerId: string
  readonly now?: Date
}

export async function getTrackingTimeTravel(
  deps: TrackingUseCasesDeps,
  command: GetTrackingTimeTravelCommand,
): Promise<TrackingTimeTravelResult> {
  const run = await runTrackingReplay(deps, command)
  return buildTrackingTimeTravelReadModel(run)
}
