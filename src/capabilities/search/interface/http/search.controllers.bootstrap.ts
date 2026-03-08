import { createSearchFacade } from '~/capabilities/search/application/search.facade'
import {
  type CreateSearchUseCaseDeps,
  createSearchUseCase,
} from '~/capabilities/search/application/search.usecase'
import { createSearchController } from '~/capabilities/search/interface/http/search.controller'
import { createSearchControllers } from '~/capabilities/search/interface/http/search.controllers'

export type SearchControllersBootstrapDeps = CreateSearchUseCaseDeps

export function bootstrapSearchControllers(deps: SearchControllersBootstrapDeps) {
  const searchUseCase = createSearchUseCase({
    processUseCases: deps.processUseCases,
    containerUseCases: deps.containerUseCases,
    trackingUseCases: deps.trackingUseCases,
  })

  const searchFacade = createSearchFacade({
    searchUseCase,
  })

  const searchController = createSearchController({
    searchFacade,
  })

  return createSearchControllers({
    searchController,
  })
}
