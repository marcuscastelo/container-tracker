import type { ContainerUseCasesForProcess } from '~/modules/process/application/process.container-usecases'
import type { ProcessRepository } from '~/modules/process/application/process.repository'

type RemoveContainerFromProcessCommand = {
  containerId: string
  processId: string
}

type RemoveContainerFromProcessResult = {
  removed: true
}

export function createRemoveContainerFromProcessUseCase(deps: {
  repository: ProcessRepository
  containerUseCases: Pick<ContainerUseCasesForProcess, 'deleteContainer' | 'listByProcessId'>
}) {
  return async function execute(
    command: RemoveContainerFromProcessCommand,
  ): Promise<RemoveContainerFromProcessResult> {
    const { containers: existing } = await deps.containerUseCases.listByProcessId({
      processId: command.processId,
    })
    await deps.containerUseCases.deleteContainer({
      containerId: command.containerId,
      processId: command.processId,
      currentContainersCount: existing.length,
    })
    return { removed: true }
  }
}
