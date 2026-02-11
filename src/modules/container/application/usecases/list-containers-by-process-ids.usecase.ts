import type { ContainerRepository } from '~/modules/container/application/container.repository'
import type { ContainerEntity } from '~/modules/container/domain/container.entity'

export type ListContainersByProcessIdsCommand = {
  processIds: readonly string[]
}

export type ListContainersByProcessIdsResult = {
  containersByProcessId: ReadonlyMap<string, readonly ContainerEntity[]>
}

export function createListContainersByProcessIdsUseCase(deps: { repository: ContainerRepository }) {
  return async function execute(
    command: ListContainersByProcessIdsCommand,
  ): Promise<ListContainersByProcessIdsResult> {
    const containersByProcessId = await deps.repository.listByProcessIds(command.processIds)
    return { containersByProcessId }
  }
}
