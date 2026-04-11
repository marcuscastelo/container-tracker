import { createSearchFacade } from '~/capabilities/search/application/search.facade'
import {
  type CreateSearchUseCaseDeps,
  createSearchSuggestionsUseCase,
  createSearchUseCase,
} from '~/capabilities/search/application/search.usecase'
import { createSearchController } from '~/capabilities/search/interface/http/search.controller'
import { createSearchControllers } from '~/capabilities/search/interface/http/search.controllers'

type SearchControllersBootstrapDeps = CreateSearchUseCaseDeps

export function bootstrapSearchControllers(deps: SearchControllersBootstrapDeps) {
  const searchUseCase = createSearchUseCase({
    processUseCases: deps.processUseCases,
    trackingUseCases: deps.trackingUseCases,
  })
  const searchSuggestionsUseCase = createSearchSuggestionsUseCase({
    processUseCases: deps.processUseCases,
    trackingUseCases: deps.trackingUseCases,
  })

  const searchFacade = createSearchFacade({
    searchUseCase,
    searchSuggestionsUseCase,
  })

  const searchController = createSearchController({
    searchFacade,
  })

  return createSearchControllers({
    searchController,
  })
}
