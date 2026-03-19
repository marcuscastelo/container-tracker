import type { ContainerRepository } from '~/modules/container/application/container.repository'

type UpdateContainerCarrierCommand = {
  readonly containerId: string
  readonly carrierCode: string | null
  readonly carrierAssignmentMode?: 'AUTO' | 'MANUAL'
  readonly carrierDetectedAt?: string | null
  readonly carrierDetectionSource?:
    | 'process-seed'
    | 'auto-detect'
    | 'manual-user'
    | 'legacy-backfill'
    | null
}

export function createUpdateContainerCarrierUseCase(deps: { repository: ContainerRepository }) {
  return async function execute(command: UpdateContainerCarrierCommand) {
    return deps.repository.updateCarrierCode({
      id: command.containerId,
      carrierCode: command.carrierCode,
      carrierAssignmentMode: command.carrierAssignmentMode,
      carrierDetectedAt: command.carrierDetectedAt,
      carrierDetectionSource: command.carrierDetectionSource,
    })
  }
}
