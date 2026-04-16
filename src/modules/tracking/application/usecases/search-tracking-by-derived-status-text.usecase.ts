import type { TrackingSearchProjection } from '~/modules/tracking/application/projection/tracking.search.readmodel'
import { listTrackingSearchProjections } from '~/modules/tracking/application/usecases/list-tracking-search-projections.usecase'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Instant } from '~/shared/time/instant'

type SearchTrackingByDerivedStatusTextCommand = Readonly<{
  query: string
  limit: number
  now?: Instant
}>

function normalizeStatusText(value: string): string {
  return value.trim().toUpperCase()
}

export async function searchTrackingByDerivedStatusText(
  deps: TrackingUseCasesDeps,
  cmd: SearchTrackingByDerivedStatusTextCommand,
): Promise<readonly TrackingSearchProjection[]> {
  const normalizedQuery = normalizeStatusText(cmd.query)
  if (normalizedQuery.length === 0 || cmd.limit <= 0) {
    return []
  }

  const projections = await listTrackingSearchProjections(
    deps,
    cmd.now === undefined ? {} : { now: cmd.now },
  )
  const matches = projections.filter(
    (projection) => normalizeStatusText(projection.latestDerivedStatus) === normalizedQuery,
  )

  return matches.slice(0, cmd.limit)
}
