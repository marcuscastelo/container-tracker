import type {
  GlobalSearchResponse,
  GlobalSearchSuggestionsResponse,
} from '~/capabilities/search/application/global-search.types'
import type {
  SearchCommand,
  SearchSuggestionsCommand,
  SearchSuggestionsUseCase,
  SearchUseCase,
} from '~/capabilities/search/application/search.usecase'

export type SearchFacade = {
  search(command: SearchCommand): Promise<GlobalSearchResponse>
  suggest(command: SearchSuggestionsCommand): Promise<GlobalSearchSuggestionsResponse>
}

type CreateSearchFacadeDeps = {
  readonly searchUseCase: SearchUseCase
  readonly searchSuggestionsUseCase: SearchSuggestionsUseCase
}

export function createSearchFacade(deps: CreateSearchFacadeDeps): SearchFacade {
  const { searchUseCase, searchSuggestionsUseCase } = deps

  return {
    search(command: SearchCommand): Promise<GlobalSearchResponse> {
      return searchUseCase(command)
    },
    suggest(command: SearchSuggestionsCommand): Promise<GlobalSearchSuggestionsResponse> {
      return searchSuggestionsUseCase(command)
    },
  }
}
