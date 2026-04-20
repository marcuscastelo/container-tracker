import {
  type SearchHttpResponseDto,
  SearchHttpResponseSchema,
} from '~/capabilities/search/ui/validation/globalSearchApi.validation'
import { typedFetch } from '~/shared/api/typedFetch'

type FetchGlobalSearchResultsCommand = Readonly<{
  query: string
  filters: readonly string[]
}>

function toSearchParams(command: FetchGlobalSearchResultsCommand): URLSearchParams {
  const params = new URLSearchParams()

  if (command.query.trim().length > 0) {
    params.set('q', command.query)
  }

  for (const filter of command.filters) {
    params.append('filter', filter)
  }

  return params
}

export async function fetchGlobalSearchResults(
  command: FetchGlobalSearchResultsCommand,
): Promise<SearchHttpResponseDto> {
  const params = toSearchParams(command)
  return typedFetch(`/api/search?${params.toString()}`, undefined, SearchHttpResponseSchema)
}
