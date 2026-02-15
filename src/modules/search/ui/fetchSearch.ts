// src/modules/search/ui/fetchSearch.ts
//
// Client-side data fetcher for the search API.

import { SearchResponseSchema } from '~/modules/search/interface/http/search.schemas'
import { typedFetch } from '~/shared/api/typedFetch'

export async function fetchSearchResults(query: string, limit = 20) {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  return typedFetch(`/api/search?${params.toString()}`, undefined, SearchResponseSchema)
}
