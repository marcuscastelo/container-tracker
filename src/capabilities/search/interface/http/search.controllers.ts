import type { SearchController } from '~/capabilities/search/interface/http/search.controller'
import { toSearchHttpResponseDto } from '~/capabilities/search/interface/http/search.http.mappers'
import {
  SearchHttpQuerySchema,
  SearchHttpResponseSchema,
} from '~/capabilities/search/interface/http/search.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'

type SearchControllerDeps = {
  readonly searchController: SearchController
}

export function createSearchControllers(deps: SearchControllerDeps) {
  const { searchController } = deps

  async function search({ request }: { request: Request }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const parsedQuery = SearchHttpQuerySchema.safeParse({
        q: url.searchParams.get('q') ?? undefined,
      })

      if (!parsedQuery.success) {
        return jsonResponse({ error: `Invalid search query: ${parsedQuery.error.message}` }, 400)
      }

      const result = await searchController.search({
        query: parsedQuery.data.q,
      })
      const response = toSearchHttpResponseDto(result)

      return jsonResponse(response, 200, SearchHttpResponseSchema)
    } catch (err) {
      console.error('GET /api/search error:', err)
      return mapErrorToResponse(err)
    }
  }

  return { search }
}
