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
import {
  type CreateProcessUseCasesDeps,
  createProcessUseCases,
} from '~/modules/process/application/process.usecases'
import { supabaseProcessRepository } from '~/modules/process/infrastructure/persistence/supabaseProcessRepository'

function pickContainerUseCasesForProcess(all: ContainerUseCases): ContainerUseCasesForProcess {
  return {
    checkExistence: all.checkExistence,
    createManyForProcess: all.createManyForProcess,
    reconcileForProcess: all.reconcileForProcess,
    deleteContainer: all.deleteContainer,
    findByNumbers: all.findByNumbers,
    listByProcessId: all.listByProcessId,
    listByProcessIds: all.listByProcessIds,
  }
}

// Container module wiring (owned by container module)
const containerUseCases = createContainerUseCases({ repository: supabaseContainerRepository })

// Restrict dependency surface: Process only sees what it needs from Container
const containerDepsForProcess = pickContainerUseCasesForProcess(containerUseCases)

const deps: CreateProcessUseCasesDeps = {
  repository: supabaseProcessRepository,
  containerUseCases: containerDepsForProcess,
}

export const processUseCases = createProcessUseCases(deps)
