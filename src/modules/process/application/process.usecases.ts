// src/modules/process/application/process.usecases.ts

import type { ContainerUseCasesForProcess } from '~/modules/process/application/process.container-usecases'
import type { ProcessRepository } from '~/modules/process/application/process.repository'

import { createCreateProcessUseCase } from '~/modules/process/application/usecases/create-process.usecase'
import { createDeleteProcessUseCase } from '~/modules/process/application/usecases/delete-process.usecase'
import { createFindProcessByIdUseCase } from '~/modules/process/application/usecases/find-process-by-id.usecase'
import { createFindProcessByIdWithContainersUseCase } from '~/modules/process/application/usecases/find-process-by-id-with-containers.usecase'
import { createListProcessesUseCase } from '~/modules/process/application/usecases/list-processes.usecase'
import { createListProcessesWithContainersUseCase } from '~/modules/process/application/usecases/list-processes-with-containers.usecase'
import { createRemoveContainerFromProcessUseCase } from '~/modules/process/application/usecases/remove-container-from-process.usecase'
import { createUpdateProcessUseCase } from '~/modules/process/application/usecases/update-process.usecase'

export type CreateProcessUseCasesDeps = {
  repository: ProcessRepository
  containerUseCases: ContainerUseCasesForProcess
}

/**
 * ProcessUseCases
 *
 * Single entry point for the process application layer.
 * No business logic here — only dependency wiring of user-facing operations.
 */
export function createProcessUseCases(deps: CreateProcessUseCasesDeps) {
  const listProcesses = createListProcessesUseCase({ repository: deps.repository })
  const listProcessesWithContainers = createListProcessesWithContainersUseCase({
    repository: deps.repository,
  })

  const findProcessById = createFindProcessByIdUseCase({ repository: deps.repository })
  const findProcessByIdWithContainers = createFindProcessByIdWithContainersUseCase({
    repository: deps.repository,
  })

  const createProcess = createCreateProcessUseCase({
    repository: deps.repository,
    containerUseCases: deps.containerUseCases,
  })

  const updateProcess = createUpdateProcessUseCase({
    repository: deps.repository,
    containerUseCases: deps.containerUseCases,
  })

  const deleteProcess = createDeleteProcessUseCase({ repository: deps.repository })

  const removeContainerFromProcess = createRemoveContainerFromProcessUseCase({
    repository: deps.repository,
    containerUseCases: deps.containerUseCases,
  })

  return {
    listProcesses,
    listProcessesWithContainers,
    findProcessById,
    findProcessByIdWithContainers,
    createProcess,
    updateProcess,
    deleteProcess,
    removeContainerFromProcess,
  }
}

export type ProcessUseCases = ReturnType<typeof createProcessUseCases>
