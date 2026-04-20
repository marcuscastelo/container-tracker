import {
  type SearchSuggestionsHttpResponseDto,
  SearchSuggestionsHttpResponseSchema,
} from '~/capabilities/search/ui/validation/globalSearchApi.validation'
import { typedFetch } from '~/shared/api/typedFetch'

type FetchGlobalSearchSuggestionsCommand = Readonly<{
  query: string
  filters: readonly string[]
}>

function toSearchParams(command: FetchGlobalSearchSuggestionsCommand): URLSearchParams {
  const params = new URLSearchParams()

  if (command.query.trim().length > 0) {
    params.set('q', command.query)
  }

  for (const filter of command.filters) {
    params.append('filter', filter)
  }

  return params
}

export async function fetchGlobalSearchSuggestions(
  command: FetchGlobalSearchSuggestionsCommand,
): Promise<SearchSuggestionsHttpResponseDto> {
  const params = toSearchParams(command)
  return typedFetch(
    `/api/search/suggestions?${params.toString()}`,
    undefined,
    SearchSuggestionsHttpResponseSchema,
  )
}
