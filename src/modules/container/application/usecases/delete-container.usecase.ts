import type { ContainerRepository } from '~/modules/container/application/container.repository'
import { CannotRemoveLastContainerError } from '~/shared/errors/container-process.errors'

type DeleteContainerCommand = {
  containerId: string
  processId: string
  currentContainersCount: number
}

export function createDeleteContainerUseCase(deps: { repository: ContainerRepository }) {
  return async function execute(params: DeleteContainerCommand): Promise<void> {
    if (params.currentContainersCount <= 1) {
      throw new CannotRemoveLastContainerError(params.processId, params.containerId)
    }

    await deps.repository.delete(params.containerId)
  }
}
