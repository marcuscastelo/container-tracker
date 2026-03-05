import type { SearchFacade } from '~/capabilities/search/application/search.facade'
import type {
  SearchCommand,
  SearchResultItem,
} from '~/capabilities/search/application/search.usecase'

export type SearchController = {
  search(command: SearchCommand): Promise<readonly SearchResultItem[]>
}

type CreateSearchControllerDeps = {
  readonly searchFacade: SearchFacade
}

export function createSearchController(deps: CreateSearchControllerDeps): SearchController {
  const { searchFacade } = deps

  return {
    search(command: SearchCommand): Promise<readonly SearchResultItem[]> {
      return searchFacade.search(command)
    },
  }
}
