import type { SearchHttpResultItemDto } from '~/capabilities/search/interface/http/search.schemas'

export type SearchResultItemVm = {
  readonly processId: string
  readonly processReference: string | null
  readonly importerName: string | null
  readonly containers: readonly string[]
  readonly carrier: string | null
  readonly vesselName: string | null
  readonly bl: string | null
  readonly derivedStatus: string | null
  readonly eta: string | null
  readonly matchSource: SearchHttpResultItemDto['matchSource']
}

export type SearchUiState = 'loading' | 'empty' | 'error' | 'ready'

export const MIN_SEARCH_QUERY_LENGTH = 3
