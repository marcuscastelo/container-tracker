import type { ContainerRepository } from '~/modules/container/application/container.repository'

import { createCheckContainerExistenceUseCase } from '~/modules/container/application/usecases/check-container-existence.usecase'
import { createCreateContainerUseCase } from '~/modules/container/application/usecases/create-container.usecase'
import { createCreateManyContainersUseCase } from '~/modules/container/application/usecases/create-many-containers.usecase'
import { createDeleteContainerUseCase } from '~/modules/container/application/usecases/delete-container.usecase'
import { createFindContainersByNumberUseCase } from '~/modules/container/application/usecases/find-containers-by-number.usecase'
import { createListContainersByProcessIdUseCase } from '~/modules/container/application/usecases/list-containers-by-process-id.usecase'
import { createListContainersByProcessIdsUseCase } from '~/modules/container/application/usecases/list-containers-by-process-ids.usecase'
import { createReconcileContainersUseCase } from '~/modules/container/application/usecases/reconcile-containers.usecase'
import { createSearchContainersByNumberUseCase } from '~/modules/container/application/usecases/search-containers-by-number.usecase'
import { createUpdateContainerCarrierUseCase } from '~/modules/container/application/usecases/update-container-carrier.usecase'

/**
 * ContainerUseCases
 *
 * Single entry point for the container application layer.
 * No business logic here — only dependency wiring of user-facing operations.
 */
export function createContainerUseCases(deps: { repository: ContainerRepository }) {
  const createContainer = createCreateContainerUseCase(deps)
  const createManyForProcess = createCreateManyContainersUseCase(deps)
  const reconcileForProcess = createReconcileContainersUseCase(deps)
  const deleteContainer = createDeleteContainerUseCase(deps)
  const checkExistence = createCheckContainerExistenceUseCase(deps)
  const findByNumbers = createFindContainersByNumberUseCase(deps)
  const listByProcessId = createListContainersByProcessIdUseCase(deps)
  const listByProcessIds = createListContainersByProcessIdsUseCase(deps)
  const searchByNumber = createSearchContainersByNumberUseCase(deps)
  const updateContainerCarrier = createUpdateContainerCarrierUseCase(deps)

  return {
    createContainer,
    createManyForProcess,
    reconcileForProcess,
    deleteContainer,
    checkExistence,
    findByNumbers,
    searchByNumber,
    listByProcessId,
    listByProcessIds,
    updateContainerCarrier,
  }
}

export type ContainerUseCases = ReturnType<typeof createContainerUseCases>
