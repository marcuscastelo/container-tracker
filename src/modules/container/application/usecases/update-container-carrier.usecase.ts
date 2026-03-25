import type { ContainerRepository } from '~/modules/container/application/container.repository'

type UpdateContainerCarrierCommand = {
  readonly containerId: string
  readonly carrierCode: string | null
  readonly carrierAssignmentMode?: 'AUTO' | 'MANUAL' | undefined
  readonly carrierDetectedAt?: string | null | undefined
  readonly carrierDetectionSource?:
    | 'process-seed'
    | 'auto-detect'
    | 'manual-user'
    | 'legacy-backfill'
    | null
    | undefined
}

export function createUpdateContainerCarrierUseCase(deps: { repository: ContainerRepository }) {
  return async function execute(command: UpdateContainerCarrierCommand) {
    return deps.repository.updateCarrierCode({
      id: command.containerId,
      carrierCode: command.carrierCode,
      ...(command.carrierAssignmentMode !== undefined
        ? { carrierAssignmentMode: command.carrierAssignmentMode }
        : {}),
      ...(command.carrierDetectedAt !== undefined
        ? { carrierDetectedAt: command.carrierDetectedAt }
        : {}),
      ...(command.carrierDetectionSource !== undefined
        ? { carrierDetectionSource: command.carrierDetectionSource }
        : {}),
    })
  }
}
