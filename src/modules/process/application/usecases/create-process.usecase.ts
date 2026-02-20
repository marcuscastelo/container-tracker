import type { ContainerUseCasesForProcess } from '~/modules/process/application/process.container-usecases'
import type { ProcessContainerRecord } from '~/modules/process/application/process.readmodels'
import type { InsertProcessRecord } from '~/modules/process/application/process.records'
import type { ProcessRepository } from '~/modules/process/application/process.repository'
import type { ProcessEntity } from '~/modules/process/domain/process.entity'
import { ContainerAlreadyExistsError } from '~/shared/errors/container-process.errors'

export type CreateProcessCommand = {
  record: InsertProcessRecord
  containers: readonly {
    container_number: string
    carrier_code: string | null
  }[]
}

export type CreateProcessResult = {
  process: ProcessEntity
  containers: readonly ProcessContainerRecord[]
  warnings: readonly string[]
}

export function createCreateProcessUseCase(deps: {
  repository: ProcessRepository
  containerUseCases: Pick<
    ContainerUseCasesForProcess,
    'checkExistence' | 'createManyForProcess' | 'findByNumbers'
  >
}) {
  return async function execute(command: CreateProcessCommand): Promise<CreateProcessResult> {
    const containerInputs = command.containers.map((c) => ({
      containerNumber: c.container_number,
      carrierCode: c.carrier_code,
    }))

    const numbers = containerInputs.map((c) => c.containerNumber)
    const checkResult = await deps.containerUseCases.checkExistence({
      containerNumbers: numbers,
    })

    const existingNumbers = [...checkResult.existenceMap.entries()]
      .filter(([, exists]) => exists)
      .map(([num]) => num)

    if (existingNumbers.length > 0) {
      const { containers: existingContainers } = await deps.containerUseCases.findByNumbers({
        containerNumbers: existingNumbers,
      })
      const firstExisting = existingContainers[0]
      if (firstExisting) {
        throw new ContainerAlreadyExistsError(String(firstExisting.containerNumber), {
          processId: String(firstExisting.processId),
          containerId: String(firstExisting.id),
          containerNumber: String(firstExisting.containerNumber),
          link: `/shipments/${String(firstExisting.processId)}`,
        })
      }
    }

    const process = await deps.repository.create(command.record)

    const { containers, warnings } = await deps.containerUseCases.createManyForProcess({
      processId: process.id,
      inputs: containerInputs.map((c) => ({
        containerNumber: c.containerNumber,
        carrierCode: c.carrierCode,
      })),
    })

    return { process, containers, warnings }
  }
}
