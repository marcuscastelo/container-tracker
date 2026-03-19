import type { ContainerRepository } from '~/modules/container/application/container.repository'
import type { ContainerEntity } from '~/modules/container/domain/container.entity'
import {
  normalizeContainerNumber,
  validateContainerWithWarnings,
} from '~/modules/container/domain/container.validation'

type CreateContainerCommand = {
  containerNumber: string
  carrierCode: string | null
  processId: string
}

type CreateContainerResult = {
  container: ContainerEntity
  warnings: string[]
}

export function createCreateContainerUseCase(deps: { repository: ContainerRepository }) {
  return async function execute(command: CreateContainerCommand): Promise<CreateContainerResult> {
    const normalized = normalizeContainerNumber(command.containerNumber)
    const warnings = validateContainerWithWarnings(normalized)

    const container = await deps.repository.insert({
      processId: command.processId,
      containerNumber: normalized,
      carrierCode: command.carrierCode,
      carrierAssignmentMode: 'AUTO',
      carrierDetectionSource: command.carrierCode ? 'process-seed' : null,
      carrierDetectedAt: null,
    })

    return {
      container,
      warnings,
    }
  }
}
