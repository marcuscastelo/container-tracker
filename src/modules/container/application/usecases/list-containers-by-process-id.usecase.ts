import type { ContainerRepository } from '~/modules/container/application/container.repository'
import type { ContainerEntity } from '~/modules/container/domain/container.entity'

type ListContainersByProcessIdCommand = {
  processId: string
}

type ListContainersByProcessIdResult = {
  containers: readonly ContainerEntity[]
}

export function createListContainersByProcessIdUseCase(deps: { repository: ContainerRepository }) {
  return async function execute(
    command: ListContainersByProcessIdCommand,
  ): Promise<ListContainersByProcessIdResult> {
    const containers = await deps.repository.listByProcessId(command.processId)
    return { containers }
  }
}
