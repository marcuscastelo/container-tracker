import type { ContainerUseCasesForProcess } from '~/modules/process/application/process.container-usecases'
import type { ProcessWithContainers } from '~/modules/process/application/process.readmodels'
import type { ProcessRepository } from '~/modules/process/application/process.repository'

type FindProcessByIdWithContainersCommand = {
  processId: string
}

type FindProcessByIdWithContainersResult = {
  process: ProcessWithContainers | null
}

export function createFindProcessByIdWithContainersUseCase(deps: {
  repository: ProcessRepository
  containerUseCases: Pick<ContainerUseCasesForProcess, 'listByProcessId'>
}) {
  return async function execute(
    command: FindProcessByIdWithContainersCommand,
  ): Promise<FindProcessByIdWithContainersResult> {
    const process = await deps.repository.fetchById(command.processId)
    if (!process) return { process: null }

    const { containers } = await deps.containerUseCases.listByProcessId({
      processId: command.processId,
    })

    return { process: { process, containers } }
  }
}
