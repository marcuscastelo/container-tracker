// src/modules/process/process.bootstrap.ts
//
// Composition root for the Process module.
// Wires repositories + cross-module UseCases, and exports ProcessUseCases.
// No business logic here.

import {
  type ContainerUseCases,
  createContainerUseCases,
} from '~/modules/container/application/container.usecases'
import { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/container.repository.supabase'
import type { ContainerUseCasesForProcess } from '~/modules/process/application/process.container-usecases'
import { createProcessUseCases } from '~/modules/process/application/process.usecases'
import { supabaseProcessRepository } from '~/modules/process/infrastructure/persistence/supabaseProcessRepository'
import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'

function pickContainerUseCasesForProcess(all: ContainerUseCases): ContainerUseCasesForProcess {
  return {
    checkExistence: all.checkExistence,
    createManyForProcess: all.createManyForProcess,
    reconcileForProcess: all.reconcileForProcess,
    deleteContainer: all.deleteContainer,
    findByNumbers: all.findByNumbers,
    listByProcessId: all.listByProcessId,
    listByProcessIds: all.listByProcessIds,
    updateCarrier: all.updateCarrier,
  }
}

// Container module wiring (owned by container module)
const containerUseCases = createContainerUseCases({ repository: supabaseContainerRepository })

// Restrict dependency surface: Process only sees what it needs from Container
const containerDepsForProcess = pickContainerUseCasesForProcess(containerUseCases)

// Tracking module wiring (for operational summary aggregation)
const { trackingUseCases } = bootstrapTrackingModule()

export const processUseCases = createProcessUseCases({
  repository: supabaseProcessRepository,
  containerUseCases: containerDepsForProcess,
  trackingUseCases,
})
