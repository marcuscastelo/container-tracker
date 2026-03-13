import type { ContainerRepository } from '~/modules/container/application/container.repository'

type UpdateContainerCarrierCommand = {
  readonly containerId: string
  readonly carrierCode: string
}

export function createUpdateContainerCarrierUseCase(deps: { repository: ContainerRepository }) {
  return async function execute(command: UpdateContainerCarrierCommand) {
    return deps.repository.updateCarrierCode({
      id: command.containerId,
      carrierCode: command.carrierCode,
    })
  }
}
