import type { ContainerRepository } from '~/modules/container/application/container.repository'
import type { ContainerEntity } from '~/modules/container/domain/container.entity'
import { normalizeContainerNumber } from '~/modules/container/domain/container.validation'

export type FindContainersByNumberCommand = {
  containerNumbers: string[]
}

export type FindContainersByNumberResult = {
  containers: ContainerEntity[]
}

export function createFindContainersByNumberUseCase(deps: { repository: ContainerRepository }) {
  return async function execute(
    params: FindContainersByNumberCommand,
  ): Promise<FindContainersByNumberResult> {
    const normalized = params.containerNumbers.map(normalizeContainerNumber)

    const containers = await deps.repository.findByNumbers(normalized)

    return {
      containers,
    }
  }
}
