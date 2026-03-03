// src/modules/search/ui/fetchSearch.ts
//
// Client-side data fetcher for the search API.

import { SearchHttpResponseSchema } from '~/capabilities/search/interface/http/search.schemas'
import { typedFetch } from '~/shared/api/typedFetch'

export async function fetchSearchResults(query: string) {
  const params = new URLSearchParams({ q: query })
  return typedFetch(`/api/search?${params.toString()}`, undefined, SearchHttpResponseSchema)
}
