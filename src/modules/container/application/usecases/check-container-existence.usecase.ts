import type { ContainerRepository } from '~/modules/container/application/container.repository'
import { normalizeContainerNumber } from '~/modules/container/domain/container.validation'

export type CheckContainerExistenceCommand = {
  containerNumbers: string[]
}

export type CheckContainerExistenceResult = {
  existenceMap: Map<string, boolean>
}

export function createCheckContainerExistenceUseCase(deps: { repository: ContainerRepository }) {
  return async function execute(
    params: CheckContainerExistenceCommand,
  ): Promise<CheckContainerExistenceResult> {
    const normalized = params.containerNumbers.map(normalizeContainerNumber)
    const existenceMap = await deps.repository.existsMany(normalized)

    return {
      existenceMap,
    }
  }
}
