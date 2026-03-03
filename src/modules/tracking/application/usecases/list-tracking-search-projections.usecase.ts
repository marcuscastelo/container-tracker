import {
  deriveTrackingSearchProjections,
  type TrackingSearchProjection,
} from '~/modules/tracking/application/projection/tracking.search.readmodel'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'

export type ListTrackingSearchProjectionsCommand = Readonly<{
  now?: Date
}>

export async function listTrackingSearchProjections(
  deps: TrackingUseCasesDeps,
  cmd: ListTrackingSearchProjectionsCommand = {},
): Promise<readonly TrackingSearchProjection[]> {
  const observations = await deps.observationRepository.listSearchObservations()
  return deriveTrackingSearchProjections({
    observations,
    now: cmd.now ?? new Date(),
  })
}
