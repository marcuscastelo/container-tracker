import type { ContainerUseCasesForProcess } from '~/modules/process/application/process.container-usecases'
import type { ProcessWithContainers } from '~/modules/process/application/process.readmodels'
import type { UpdateProcessRecord } from '~/modules/process/application/process.records'
import type { ProcessRepository } from '~/modules/process/application/process.repository'

type UpdateProcessContainerInput = {
  container_number: string
  carrier_code: string | null
}

type UpdateProcessCommand = {
  processId: string
  record: UpdateProcessRecord
  containers?: readonly UpdateProcessContainerInput[]
}

type UpdateProcessResult = {
  process: ProcessWithContainers | null
}

export function createUpdateProcessUseCase(deps: {
  repository: ProcessRepository
  containerUseCases: Pick<ContainerUseCasesForProcess, 'reconcileForProcess' | 'listByProcessId'>
}) {
  return async function execute(command: UpdateProcessCommand): Promise<UpdateProcessResult> {
    const shouldSyncContainerCarriers =
      command.containers === undefined && command.record.carrier !== undefined

    if (command.containers || shouldSyncContainerCarriers) {
      const { containers: existing } = await deps.containerUseCases.listByProcessId({
        processId: command.processId,
      })

      const incomingContainers =
        command.containers ??
        existing.map((container) => ({
          container_number: String(container.containerNumber),
          carrier_code: command.record.carrier ?? container.carrierCode,
        }))

      await deps.containerUseCases.reconcileForProcess({
        processId: command.processId,
        existing: existing.map((c) => ({
          id: String(c.id),
          containerNumber: String(c.containerNumber),
          carrierCode: c.carrierCode,
        })),
        incoming: incomingContainers.map((c) => ({
          containerNumber: c.container_number,
          carrierCode: c.carrier_code,
        })),
      })
    }

    if (Object.keys(command.record).length > 0) {
      await deps.repository.update(command.processId, command.record)
    }

    const process = await deps.repository.fetchById(command.processId)
    if (!process) return { process: null }

    const { containers } = await deps.containerUseCases.listByProcessId({
      processId: command.processId,
    })

    return { process: { process, containers } }
  }
}
