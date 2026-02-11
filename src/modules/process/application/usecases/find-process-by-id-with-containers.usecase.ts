import type { ProcessRepository } from '~/modules/process/application/process.repository'
import type { ProcessWithContainers } from '~/modules/process/domain/processStuff'

export type FindProcessByIdWithContainersCommand = {
  processId: string
}

export type FindProcessByIdWithContainersResult = {
  process: ProcessWithContainers | null
}

export function createFindProcessByIdWithContainersUseCase(deps: {
  repository: ProcessRepository
}) {
  return async function execute(
    command: FindProcessByIdWithContainersCommand,
  ): Promise<FindProcessByIdWithContainersResult> {
    const process = await deps.repository.fetchByIdWithContainers(command.processId)
    return { process }
  }
}
