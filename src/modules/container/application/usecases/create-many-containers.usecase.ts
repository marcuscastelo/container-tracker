import type { ContainerRepository } from '~/modules/container/application/container.repository'
import type { ContainerEntity } from '~/modules/container/domain/container.entity'
import {
  normalizeContainerNumber,
  validateContainerWithWarnings,
} from '~/modules/container/domain/container.validation'
import { DuplicateContainersError } from '~/shared/errors/container-process.errors'

export type CreateManyContainersCommand = {
  processId: string
  inputs: {
    containerNumber: string
    carrierCode?: string | null
  }[]
}

export type CreateManyContainersResult = {
  containers: ContainerEntity[]
  warnings: string[]
}

export function createCreateManyContainersUseCase(deps: { repository: ContainerRepository }) {
  return async function execute(
    params: CreateManyContainersCommand,
  ): Promise<CreateManyContainersResult> {
    const warnings: string[] = []

    const normalized = params.inputs.map((input) => {
      const containerNumber = normalizeContainerNumber(input.containerNumber)
      warnings.push(...validateContainerWithWarnings(containerNumber))

      return {
        containerNumber,
        carrierCode: input.carrierCode ?? '',
      }
    })

    // Duplicate check
    const seen = new Set<string>()
    const duplicates: string[] = []

    for (const item of normalized) {
      if (seen.has(item.containerNumber)) {
        duplicates.push(item.containerNumber)
      } else {
        seen.add(item.containerNumber)
      }
    }

    if (duplicates.length > 0) {
      throw new DuplicateContainersError(duplicates)
    }

    const containers = await deps.repository.insertMany(
      normalized.map((item) => ({
        processId: params.processId,
        containerNumber: item.containerNumber,
        carrierCode: item.carrierCode,
      })),
    )

    return {
      containers,
      warnings,
    }
  }
}
