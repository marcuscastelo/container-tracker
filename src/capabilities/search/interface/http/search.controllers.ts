import type { SearchController } from '~/capabilities/search/interface/http/search.controller'
import {
  toSearchHttpResponseDto,
  toSearchSuggestionsHttpResponseDto,
} from '~/capabilities/search/interface/http/search.http.mappers'
import {
  SearchHttpQuerySchema,
  SearchHttpResponseSchema,
  SearchSuggestionsHttpResponseSchema,
} from '~/capabilities/search/interface/http/search.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'

type SearchControllerDeps = {
  readonly searchController: SearchController
}

function parseQueryParams(url: URL) {
  return SearchHttpQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    filter: url.searchParams.getAll('filter'),
  })
}

export function createSearchControllers(deps: SearchControllerDeps) {
  const { searchController } = deps

  async function search({ request }: { request: Request }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const parsedQuery = parseQueryParams(url)

      if (!parsedQuery.success) {
        return jsonResponse({ error: `Invalid search query: ${parsedQuery.error.message}` }, 400)
      }

      const result = await searchController.search({
        query: parsedQuery.data.q,
        filters: parsedQuery.data.filter,
      })

      return jsonResponse(toSearchHttpResponseDto(result), 200, SearchHttpResponseSchema)
    } catch (error) {
      console.error('GET /api/search error:', error)
      return mapErrorToResponse(error)
    }
  }

  async function suggestions({ request }: { request: Request }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const parsedQuery = parseQueryParams(url)

      if (!parsedQuery.success) {
        return jsonResponse({ error: `Invalid search query: ${parsedQuery.error.message}` }, 400)
      }

      const result = await searchController.suggest({
        query: parsedQuery.data.q,
        filters: parsedQuery.data.filter,
      })

      return jsonResponse(
        toSearchSuggestionsHttpResponseDto(result),
        200,
        SearchSuggestionsHttpResponseSchema,
      )
    } catch (error) {
      console.error('GET /api/search/suggestions error:', error)
      return mapErrorToResponse(error)
    }
  }

  return { search, suggestions }
}
