import type { ContainerRepository } from '~/modules/container/application/container.repository'
import { normalizeContainerNumber } from '~/modules/container/domain/container.validation'

type UpdateContainerCarrierCommand = {
  readonly containerId: string
  readonly containerNumber: string
  readonly carrierCode: string
}

export function createUpdateContainerCarrierUseCase(deps: {
  readonly repository: ContainerRepository
}) {
  return async function execute(command: UpdateContainerCarrierCommand): Promise<void> {
    await deps.repository.update({
      id: command.containerId,
      containerNumber: normalizeContainerNumber(command.containerNumber),
      carrierCode: command.carrierCode,
    })
  }
}
