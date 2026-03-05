import type {
  SearchCommand,
  SearchResultItem,
  SearchUseCase,
} from '~/capabilities/search/application/search.usecase'

export type SearchFacade = {
  search(command: SearchCommand): Promise<readonly SearchResultItem[]>
}

type CreateSearchFacadeDeps = {
  readonly searchUseCase: SearchUseCase
}

export function createSearchFacade(deps: CreateSearchFacadeDeps): SearchFacade {
  const { searchUseCase } = deps

  return {
    search(command: SearchCommand): Promise<readonly SearchResultItem[]> {
      return searchUseCase(command)
    },
  }
}
