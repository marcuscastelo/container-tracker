// src/modules/process/application/process.usecases.ts

import type { ContainerUseCasesForProcess } from '~/modules/process/application/process.container-usecases'
import type { ProcessRepository } from '~/modules/process/application/process.repository'

import { createCreateProcessUseCase } from '~/modules/process/application/usecases/create-process.usecase'
import { createDeleteProcessUseCase } from '~/modules/process/application/usecases/delete-process.usecase'
import { createFindProcessByIdUseCase } from '~/modules/process/application/usecases/find-process-by-id.usecase'
import { createFindProcessByIdWithContainersUseCase } from '~/modules/process/application/usecases/find-process-by-id-with-containers.usecase'
import {
  createListProcessSyncStatesUseCase,
  type ListProcessSyncStatesDeps,
} from '~/modules/process/application/usecases/list-process-sync-states.usecase'
import { createListProcessesUseCase } from '~/modules/process/application/usecases/list-processes.usecase'
import { createListProcessesWithContainersUseCase } from '~/modules/process/application/usecases/list-processes-with-containers.usecase'
import {
  createListProcessesWithOperationalSummaryUseCase,
  type ListProcessesWithOperationalSummaryDeps,
} from '~/modules/process/application/usecases/list-processes-with-operational-summary.usecase'
import {
  createRefreshProcessUseCase,
  type RefreshProcessDeps,
} from '~/modules/process/application/usecases/refresh-process.usecase'
import { createRemoveContainerFromProcessUseCase } from '~/modules/process/application/usecases/remove-container-from-process.usecase'
import { createSearchProcessesByTextUseCase } from '~/modules/process/application/usecases/search-processes-by-text.usecase'
import {
  createSyncAllProcessesUseCase,
  type SyncAllProcessesDeps,
} from '~/modules/process/application/usecases/sync-all-processes.usecase'
import {
  createSyncProcessContainersUseCase,
  type SyncProcessContainersDeps,
} from '~/modules/process/application/usecases/sync-process-containers.usecase'
import { createUpdateProcessUseCase } from '~/modules/process/application/usecases/update-process.usecase'

export type CreateProcessUseCasesDeps = {
  repository: ProcessRepository
  containerUseCases: ContainerUseCasesForProcess
  trackingUseCases: ListProcessesWithOperationalSummaryDeps['trackingUseCases']
  syncAllProcessesDeps: SyncAllProcessesDeps
  syncProcessContainersDeps: SyncProcessContainersDeps
  listProcessSyncStatesDeps: ListProcessSyncStatesDeps
  refreshProcessDeps: RefreshProcessDeps
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
    containerUseCases: deps.containerUseCases,
  })

  const findProcessById = createFindProcessByIdUseCase({ repository: deps.repository })
  const findProcessByIdWithContainers = createFindProcessByIdWithContainersUseCase({
    repository: deps.repository,
    containerUseCases: deps.containerUseCases,
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
  const searchByText = createSearchProcessesByTextUseCase({
    repository: deps.repository,
  })

  const listProcessesWithOperationalSummary = createListProcessesWithOperationalSummaryUseCase({
    repository: deps.repository,
    containerUseCases: deps.containerUseCases,
    trackingUseCases: deps.trackingUseCases,
  })
  const syncAllProcesses = createSyncAllProcessesUseCase(deps.syncAllProcessesDeps)
  const syncProcessContainers = createSyncProcessContainersUseCase(deps.syncProcessContainersDeps)
  const listProcessSyncStates = createListProcessSyncStatesUseCase(deps.listProcessSyncStatesDeps)
  const refreshProcess = createRefreshProcessUseCase(deps.refreshProcessDeps)

  return {
    listProcesses,
    listProcessesWithContainers,
    listProcessesWithOperationalSummary,
    findProcessById,
    findProcessByIdWithContainers,
    createProcess,
    updateProcess,
    deleteProcess,
    removeContainerFromProcess,
    searchByText,
    syncAllProcesses,
    syncProcessContainers,
    listProcessSyncStates,
    refreshProcess,
  }
}

export type ProcessUseCases = ReturnType<typeof createProcessUseCases>
