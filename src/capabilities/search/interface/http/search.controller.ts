import type {
  GlobalSearchResponse,
  GlobalSearchSuggestionsResponse,
} from '~/capabilities/search/application/global-search.types'
import type { SearchFacade } from '~/capabilities/search/application/search.facade'
import type {
  SearchCommand,
  SearchSuggestionsCommand,
} from '~/capabilities/search/application/search.usecase'

export type SearchController = {
  search(command: SearchCommand): Promise<GlobalSearchResponse>
  suggest(command: SearchSuggestionsCommand): Promise<GlobalSearchSuggestionsResponse>
}

type CreateSearchControllerDeps = {
  readonly searchFacade: SearchFacade
}

export function createSearchController(deps: CreateSearchControllerDeps): SearchController {
  const { searchFacade } = deps

  return {
    search(command: SearchCommand): Promise<GlobalSearchResponse> {
      return searchFacade.search(command)
    },
    suggest(command: SearchSuggestionsCommand): Promise<GlobalSearchSuggestionsResponse> {
      return searchFacade.suggest(command)
    },
  }
}
