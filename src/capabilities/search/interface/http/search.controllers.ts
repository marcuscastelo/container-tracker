// src/modules/search/interface/http/search.controllers.ts
//
// Controller factory for the search HTTP endpoint.

import type { SearchUseCases } from '~/capabilities/search/application/search.usecases'
import { toSearchResponseDto } from '~/capabilities/search/interface/http/search.http.mappers'
import {
  SearchQuerySchema,
  SearchResponseSchema,
} from '~/capabilities/search/interface/http/search.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

export type SearchControllerDeps = {
  readonly searchUseCases: SearchUseCases
}

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createSearchControllers(deps: SearchControllerDeps) {
  const { searchUseCases } = deps

  // -----------------------------------------------------------------------
  // GET /api/search?q=...&limit=...
  // -----------------------------------------------------------------------
  async function search({ request }: { request: Request }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const rawParams = {
        q: url.searchParams.get('q') ?? '',
        limit: url.searchParams.get('limit') ?? undefined,
      }

      const parsed = SearchQuerySchema.safeParse(rawParams)
      if (!parsed.success) {
        return jsonResponse({ error: `Invalid search query: ${parsed.error.message}` }, 400)
      }

      const result = await searchUseCases.search({
        query: parsed.data.q,
        limit: parsed.data.limit,
      })

      const response = toSearchResponseDto(result)
      return jsonResponse(response, 200, SearchResponseSchema)
    } catch (err) {
      console.error('GET /api/search error:', err)
      return mapErrorToResponse(err)
    }
  }

  return { search }
}
