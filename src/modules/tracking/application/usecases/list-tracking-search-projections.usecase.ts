import {
  deriveTrackingSearchProjections,
  type TrackingSearchProjection,
} from '~/modules/tracking/application/projection/tracking.search.readmodel'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import { systemClock } from '~/shared/time/clock'
import type { Instant } from '~/shared/time/instant'

type ListTrackingSearchProjectionsCommand = Readonly<{
  now?: Instant
}>

export async function listTrackingSearchProjections(
  deps: TrackingUseCasesDeps,
  cmd: ListTrackingSearchProjectionsCommand = {},
): Promise<readonly TrackingSearchProjection[]> {
  const observations = await deps.observationRepository.listSearchObservations()
  return deriveTrackingSearchProjections({
    observations,
    now: cmd.now ?? systemClock.now(),
  })
}
