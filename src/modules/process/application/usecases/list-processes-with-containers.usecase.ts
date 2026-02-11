import type { ProcessRepository } from '~/modules/process/application/process.repository'
import type { ProcessWithContainers } from '~/modules/process/domain/processStuff'

export type ListProcessesWithContainersCommand = never

export type ListProcessesWithContainersResult = {
  processes: readonly ProcessWithContainers[]
}

export function createListProcessesWithContainersUseCase(deps: { repository: ProcessRepository }) {
  return async function execute(): Promise<ListProcessesWithContainersResult> {
    const processes = await deps.repository.fetchAllWithContainers()
    return { processes }
  }
}
