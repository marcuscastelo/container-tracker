import { bootstrapSearchControllers } from '~/capabilities/search/interface/http/search.controllers.bootstrap'
import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'

const { trackingUseCases } = bootstrapTrackingModule()

export const searchControllers = bootstrapSearchControllers({
  processUseCases,
  containerUseCases,
  trackingUseCases,
})
