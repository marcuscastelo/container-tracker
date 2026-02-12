import type { ContainerUseCasesForProcess } from '~/modules/process/application/process.container-usecases'
import type { ProcessWithContainers } from '~/modules/process/application/process.readmodels'
import type { ProcessRepository } from '~/modules/process/application/process.repository'

export type ListProcessesWithContainersCommand = never

export type ListProcessesWithContainersResult = {
  processes: readonly ProcessWithContainers[]
}

export function createListProcessesWithContainersUseCase(deps: {
  repository: ProcessRepository
  containerUseCases: Pick<ContainerUseCasesForProcess, 'listByProcessIds'>
}) {
  return async function execute(): Promise<ListProcessesWithContainersResult> {
    const allProcesses = await deps.repository.fetchAll()
    const processIds = allProcesses.map((p) => p.id)

    const { containersByProcessId } = await deps.containerUseCases.listByProcessIds({
      processIds,
    })

    const processes: ProcessWithContainers[] = allProcesses.map((process) => ({
      process,
      containers: containersByProcessId.get(process.id) ?? [],
    }))

    return { processes }
  }
}
