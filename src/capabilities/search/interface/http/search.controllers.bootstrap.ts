import { createSearchFacade } from '~/capabilities/search/application/search.facade'
import { createSearchUseCase } from '~/capabilities/search/application/search.usecase'
import { createSearchController } from '~/capabilities/search/interface/http/search.controller'
import { createSearchControllers } from '~/capabilities/search/interface/http/search.controllers'
import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'

const { trackingUseCases } = bootstrapTrackingModule()

const searchUseCase = createSearchUseCase({
  processUseCases,
  containerUseCases,
  trackingUseCases,
})

const searchFacade = createSearchFacade({
  searchUseCase,
})

const searchController = createSearchController({
  searchFacade,
})

export const searchControllers = createSearchControllers({
  searchController,
})
