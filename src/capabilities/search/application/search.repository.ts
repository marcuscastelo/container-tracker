// src/modules/search/application/search.repository.ts
//
// Port (interface) for the search read-model repository.
// Infrastructure layer provides the implementation.

import type { SearchResultItemProjection } from '~/capabilities/search/application/search.types'

export type SearchRepository = {
  /**
   * Search across processes and containers using a single query string.
   * Returns lightweight projections ordered by relevance.
   *
   * @param query - The search term (case-insensitive)
   * @param limit - Max results to return (default 20)
   */
  search(query: string, limit: number): Promise<readonly SearchResultItemProjection[]>
}
