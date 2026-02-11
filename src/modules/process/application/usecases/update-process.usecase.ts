import type { ContainerUseCasesForProcess } from '~/modules/process/application/process.container-usecases'
import type { UpdateProcessRecord } from '~/modules/process/application/process.records'
import type { ProcessRepository } from '~/modules/process/application/process.repository'
import type { ProcessWithContainers } from '~/modules/process/domain/processStuff'

export type UpdateProcessContainerInput = {
  container_number: string
  carrier_code: string | null
}

export type ContainerInput = {
  containerNumber: string
  carrier_code: string | null
}

export type UpdateProcessCommand = {
  processId: string
  record: UpdateProcessRecord
  containers?: readonly UpdateProcessContainerInput[]
}

export type UpdateProcessResult = {
  process: ProcessWithContainers | null
}

export function createUpdateProcessUseCase(deps: {
  repository: ProcessRepository
  containerUseCases: Pick<ContainerUseCasesForProcess, 'reconcileForProcess'>
}) {
  return async function execute(command: UpdateProcessCommand): Promise<UpdateProcessResult> {
    if (command.containers) {
      const existing = await deps.repository.fetchContainersByProcessId(command.processId)

      const desired: ContainerInput[] = command.containers.map((c) => ({
        containerNumber: c.container_number,
        carrier_code: c.carrier_code,
      }))

      await deps.containerUseCases.reconcileForProcess({
        processId: command.processId,
        existing: existing.map((c) => ({
          id: c.id,
          containerNumber: c.container_number,
        })),
        incoming: desired,
      })
    }

    if (Object.keys(command.record).length > 0) {
      await deps.repository.update(command.processId, command.record)
    }

    const process = await deps.repository.fetchByIdWithContainers(command.processId)
    return { process } // controller decide 404 se null
  }
}
