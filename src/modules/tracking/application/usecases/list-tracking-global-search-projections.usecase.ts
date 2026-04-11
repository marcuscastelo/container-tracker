import {
  deriveTrackingGlobalSearchProjections,
  type TrackingGlobalSearchProjection,
} from '~/modules/tracking/application/projection/tracking.global-search.readmodel'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import { systemClock } from '~/shared/time/clock'
import type { Instant } from '~/shared/time/instant'

type ListTrackingGlobalSearchProjectionsCommand = Readonly<{
  now?: Instant
}>

export async function listTrackingGlobalSearchProjections(
  deps: TrackingUseCasesDeps,
  command: ListTrackingGlobalSearchProjectionsCommand = {},
): Promise<readonly TrackingGlobalSearchProjection[]> {
  const observations = await deps.observationRepository.listSearchObservations()

  return deriveTrackingGlobalSearchProjections({
    observations,
    now: command.now ?? systemClock.now(),
  })
}
