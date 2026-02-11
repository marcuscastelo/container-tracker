import type { ContainerEntity } from '~/modules/container/domain/container.entity'
import { ContainerAlreadyExistsError } from '~/modules/process/application/errors'
import type { ContainerUseCasesForProcess } from '~/modules/process/application/process.container-usecases'
import type { InsertProcessRecord } from '~/modules/process/application/process.records'
import type { ProcessRepository } from '~/modules/process/application/process.repository'
import type { Process } from '~/modules/process/domain/process'

export type ContainerInputForProcess = {
  container_number: string
  carrier_code: string | null
}

// ajuste se o container module usa outro shape
export type ContainerInput = {
  containerNumber: string
  carrierCode: string | null
}

export type CreateProcessCommand = {
  record: InsertProcessRecord
  containers: readonly ContainerInputForProcess[]
}

export type CreateProcessResult = {
  process: Process
  containers: readonly ContainerEntity[] // troque pelo tipo real (ContainerEntity) se quiser
  warnings: readonly string[]
}

export function createCreateProcessUseCase(deps: {
  repository: ProcessRepository
  containerUseCases: Pick<ContainerUseCasesForProcess, 'checkExistence' | 'createManyForProcess'>
}) {
  return async function execute(command: CreateProcessCommand): Promise<CreateProcessResult> {
    const containerInputs: ContainerInput[] = command.containers.map((c) => ({
      containerNumber: c.container_number,
      carrierCode: c.carrier_code,
    }))

    const numbers = containerInputs.map((c) => c.containerNumber)
    const checkResult = await deps.containerUseCases.checkExistence({
      containerNumbers: numbers,
    })

    for (const [containerNumber, exists] of checkResult.existenceMap.entries()) {
      if (!exists) continue
      const existing = await deps.repository.fetchContainerByNumber(containerNumber)
      if (existing) throw new ContainerAlreadyExistsError(containerNumber, existing)
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
