// src/modules/process/interface/http/process.controllers.bootstrap.ts
//
// Composition root for the Process controllers.
// Wires controllers with their cross-module dependencies.
// No business logic here.

import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import { createProcessControllers } from '~/modules/process/interface/http/process.controllers'
import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'

const { usecases: trackingUseCases } = bootstrapTrackingModule()

export const processControllers = createProcessControllers({
  processUseCases,
  containerUseCases,
  trackingUseCases,
})
