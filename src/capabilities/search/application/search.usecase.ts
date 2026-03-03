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
const SEARCH_RESULTS_LIMIT = 30

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
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

function normalizeText(value: string | null): string | null {
  if (value === null) return null

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function containsQuery(value: string | null, normalizedQuery: string): boolean {
  const normalizedValue = normalizeText(value)
  if (normalizedValue === null) return false

  return normalizedValue.includes(normalizedQuery)
}

function isExactMatch(value: string | null, normalizedQuery: string): boolean {
  const normalizedValue = normalizeText(value)
  if (normalizedValue === null) return false

  return normalizedValue === normalizedQuery
}

function resolveProcessMatchSource(
  projection: ProcessSearchProjection,
  normalizedQuery: string,
): SearchMatchSource {
  if (containsQuery(projection.reference, normalizedQuery)) return 'process'
  if (containsQuery(projection.importerName, normalizedQuery)) return 'importer'
  if (containsQuery(projection.billOfLading, normalizedQuery)) return 'bl'
  if (containsQuery(projection.carrier, normalizedQuery)) return 'carrier'

  return 'process'
}

const MATCH_SOURCE_PRIORITY: Readonly<Record<SearchMatchSource, number>> = {
  container: 0,
  process: 1,
  importer: 2,
  bl: 3,
  carrier: 4,
  vessel: 5,
  status: 6,
}

const MATCH_RANK_PRIORITY = {
  exactContainer: 0,
  exactProcessReference: 1,
  partialContainer: 2,
  processText: 3,
  vessel: 4,
  status: 5,
  fallback: 6,
} as const

type MutableSearchResultItem = {
  processId: string
  processReference: string | null
  importerName: string | null
  containers: string[]
  carrier: string | null
  vesselName: string | null
  bl: string | null
  derivedStatus: string | null
  eta: string | null
  matchSource: SearchMatchSource
  hasExactContainerMatch: boolean
  hasPartialContainerMatch: boolean
  hasExactProcessReferenceMatch: boolean
  hasProcessTextMatch: boolean
  hasVesselMatch: boolean
  hasStatusMatch: boolean
}

function createEmptySearchResultItem(
  processId: string,
  matchSource: SearchMatchSource,
): MutableSearchResultItem {
  return {
    processId,
    processReference: null,
    importerName: null,
    containers: [],
    carrier: null,
    vesselName: null,
    bl: null,
    derivedStatus: null,
    eta: null,
    matchSource,
    hasExactContainerMatch: false,
    hasPartialContainerMatch: false,
    hasExactProcessReferenceMatch: false,
    hasProcessTextMatch: false,
    hasVesselMatch: false,
    hasStatusMatch: false,
  }
}

function mergeMatchSource(
  currentSource: SearchMatchSource,
  nextSource: SearchMatchSource,
): SearchMatchSource {
  const currentPriority = MATCH_SOURCE_PRIORITY[currentSource]
  const nextPriority = MATCH_SOURCE_PRIORITY[nextSource]

  return nextPriority < currentPriority ? nextSource : currentSource
}

function getOrCreateResult(
  consolidated: Map<string, MutableSearchResultItem>,
  processId: string,
  source: SearchMatchSource,
): MutableSearchResultItem {
  const existing = consolidated.get(processId)
  if (existing) {
    existing.matchSource = mergeMatchSource(existing.matchSource, source)
    return existing
  }

  const created = createEmptySearchResultItem(processId, source)
  consolidated.set(processId, created)
  return created
}

function compareStringAsc(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function toSortableReference(reference: string | null): string {
  const normalizedReference = normalizeText(reference)
  return normalizedReference ?? '\uffff'
}

function resolveMatchRankPriority(item: MutableSearchResultItem): number {
  if (item.hasExactContainerMatch) return MATCH_RANK_PRIORITY.exactContainer
  if (item.hasExactProcessReferenceMatch) return MATCH_RANK_PRIORITY.exactProcessReference
  if (item.hasPartialContainerMatch) return MATCH_RANK_PRIORITY.partialContainer
  if (item.hasProcessTextMatch) return MATCH_RANK_PRIORITY.processText
  if (item.hasVesselMatch) return MATCH_RANK_PRIORITY.vessel
  if (item.hasStatusMatch) return MATCH_RANK_PRIORITY.status
  return MATCH_RANK_PRIORITY.fallback
}

function compareConsolidatedResults(
  left: MutableSearchResultItem,
  right: MutableSearchResultItem,
): number {
  const rankDiff = resolveMatchRankPriority(left) - resolveMatchRankPriority(right)
  if (rankDiff !== 0) return rankDiff

  const referenceCompare = compareStringAsc(
    toSortableReference(left.processReference),
    toSortableReference(right.processReference),
  )
  if (referenceCompare !== 0) return referenceCompare

  return compareStringAsc(left.processId, right.processId)
}

export function createSearchUseCase(deps: CreateSearchUseCaseDeps): SearchUseCase {
  const searchLimit = SEARCH_RESULTS_LIMIT

  return async function search(command: SearchCommand): Promise<readonly SearchResultItem[]> {
    const normalizedQuery = normalizeQuery(command.query)
    if (normalizedQuery.length < MIN_SEARCH_QUERY_LENGTH) {
      return []
    }

    const [processMatches, containerMatches, vesselMatches, statusMatches] = await Promise.all([
      deps.processUseCases.searchByText(normalizedQuery, searchLimit),
      deps.containerUseCases.searchByNumber(normalizedQuery, searchLimit),
      deps.trackingUseCases.searchByVesselName(normalizedQuery, searchLimit),
      deps.trackingUseCases.searchByDerivedStatusText(normalizedQuery, searchLimit),
    ])

    const consolidated = new Map<string, MutableSearchResultItem>()

    for (const processMatch of processMatches) {
      const source = resolveProcessMatchSource(processMatch, normalizedQuery)
      const result = getOrCreateResult(consolidated, processMatch.processId, source)
      const processReferenceMatches = containsQuery(processMatch.reference, normalizedQuery)
      const importerMatches = containsQuery(processMatch.importerName, normalizedQuery)
      const billOfLadingMatches = containsQuery(processMatch.billOfLading, normalizedQuery)
      const carrierMatches = containsQuery(processMatch.carrier, normalizedQuery)

      result.processReference = processMatch.reference
      result.importerName = processMatch.importerName
      result.bl = processMatch.billOfLading
      result.carrier = processMatch.carrier
      result.hasExactProcessReferenceMatch =
        result.hasExactProcessReferenceMatch ||
        isExactMatch(processMatch.reference, normalizedQuery)
      result.hasProcessTextMatch =
        result.hasProcessTextMatch ||
        processReferenceMatches ||
        importerMatches ||
        billOfLadingMatches ||
        carrierMatches
    }

    for (const containerMatch of containerMatches) {
      const result = getOrCreateResult(consolidated, containerMatch.processId, 'container')
      if (isExactMatch(containerMatch.containerNumber, normalizedQuery)) {
        result.hasExactContainerMatch = true
      } else {
        result.hasPartialContainerMatch = true
      }

      if (!result.containers.includes(containerMatch.containerNumber)) {
        result.containers.push(containerMatch.containerNumber)
      }
    }

    for (const vesselMatch of vesselMatches) {
      const result = getOrCreateResult(consolidated, vesselMatch.processId, 'vessel')

      result.vesselName = vesselMatch.vesselName
      result.derivedStatus = vesselMatch.latestDerivedStatus
      result.eta = vesselMatch.latestEta
      result.hasVesselMatch = true
    }

    for (const statusMatch of statusMatches) {
      const result = getOrCreateResult(consolidated, statusMatch.processId, 'status')

      result.vesselName = statusMatch.vesselName
      result.derivedStatus = statusMatch.latestDerivedStatus
      result.eta = statusMatch.latestEta
      result.hasStatusMatch = true
    }

    const consolidatedResults = Array.from(consolidated.values()).sort(compareConsolidatedResults)

    return consolidatedResults.slice(0, SEARCH_RESULTS_LIMIT).map((item) => ({
      processId: item.processId,
      processReference: item.processReference,
      importerName: item.importerName,
      containers: item.containers,
      carrier: item.carrier,
      vesselName: item.vesselName,
      bl: item.bl,
      derivedStatus: item.derivedStatus,
      eta: item.eta,
      matchSource: item.matchSource,
    }))
  }
}
