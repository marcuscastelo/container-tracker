import type { TrackingSearchProjection } from '~/modules/tracking/application/projection/tracking.search.readmodel'
import { listTrackingSearchProjections } from '~/modules/tracking/application/usecases/list-tracking-search-projections.usecase'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'

export type SearchTrackingByVesselNameCommand = Readonly<{
  query: string
  limit: number
  now?: Date
}>

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function hasVesselMatch(vesselName: string | null, normalizedQuery: string): boolean {
  return vesselName !== null && normalizeText(vesselName).includes(normalizedQuery)
}

export async function searchTrackingByVesselName(
  deps: TrackingUseCasesDeps,
  cmd: SearchTrackingByVesselNameCommand,
): Promise<readonly TrackingSearchProjection[]> {
  const normalizedQuery = normalizeText(cmd.query)
  if (normalizedQuery.length === 0 || cmd.limit <= 0) {
    return []
  }

  const projections = await listTrackingSearchProjections(deps, { now: cmd.now })
  const matches = projections.filter((projection) =>
    hasVesselMatch(projection.vesselName, normalizedQuery),
  )

  return matches.slice(0, cmd.limit)
}
