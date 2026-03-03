import type { ContainerSearchProjection } from '~/modules/container/application/container.readmodels'
import type { ProcessSearchProjection } from '~/modules/process/application/process.readmodels'
import type { TrackingSearchProjection } from '~/modules/tracking/application/projection/tracking.search.readmodel'

export type SearchMatchSource =
  | 'container'
  | 'process'
  | 'importer'
  | 'bl'
  | 'vessel'
  | 'status'
  | 'carrier'

export type SearchCommand = {
  readonly query: string
}

export type SearchResultItem = {
  readonly processId: string
  readonly processReference: string | null
  readonly importerName: string | null
  readonly containers: readonly string[]
  readonly carrier: string | null
  readonly vesselName: string | null
  readonly bl: string | null
  readonly derivedStatus: string | null
  readonly eta: string | null
  readonly matchSource: SearchMatchSource
}

export type SearchUseCase = (command: SearchCommand) => Promise<readonly SearchResultItem[]>

const MIN_SEARCH_QUERY_LENGTH = 3
const DEFAULT_SEARCH_LIMIT = 30

type ProcessSearchUseCases = {
  searchByText(query: string, limit: number): Promise<readonly ProcessSearchProjection[]>
}

type ContainerSearchUseCases = {
  searchByNumber(query: string, limit: number): Promise<readonly ContainerSearchProjection[]>
}

type TrackingSearchUseCases = {
  searchByVesselName(query: string, limit: number): Promise<readonly TrackingSearchProjection[]>
  searchByDerivedStatusText(
    query: string,
    limit: number,
  ): Promise<readonly TrackingSearchProjection[]>
}

export type CreateSearchUseCaseDeps = {
  readonly processUseCases: ProcessSearchUseCases
  readonly containerUseCases: ContainerSearchUseCases
  readonly trackingUseCases: TrackingSearchUseCases
  readonly limit?: number
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

export function createSearchUseCase(deps: CreateSearchUseCaseDeps): SearchUseCase {
  const searchLimit = deps.limit ?? DEFAULT_SEARCH_LIMIT

  return async function search(command: SearchCommand): Promise<readonly SearchResultItem[]> {
    const normalizedQuery = normalizeQuery(command.query)
    if (normalizedQuery.length < MIN_SEARCH_QUERY_LENGTH) {
      return []
    }

    await Promise.all([
      deps.processUseCases.searchByText(normalizedQuery, searchLimit),
      deps.containerUseCases.searchByNumber(normalizedQuery, searchLimit),
      deps.trackingUseCases.searchByVesselName(normalizedQuery, searchLimit),
      deps.trackingUseCases.searchByDerivedStatusText(normalizedQuery, searchLimit),
    ])

    return []
  }
}
