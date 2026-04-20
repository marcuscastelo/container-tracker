import type {
  TrackingValidationLifecycleState,
  TrackingValidationLifecycleTransition,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationLifecycle'

export type TrackingValidationLifecycleRepository = {
  findActiveStatesByContainerId(
    containerId: string,
  ): Promise<readonly TrackingValidationLifecycleState[]>
  insertMany(transitions: readonly TrackingValidationLifecycleTransition[]): Promise<void>
}

export const noopTrackingValidationLifecycleRepository: TrackingValidationLifecycleRepository = {
  async findActiveStatesByContainerId() {
    return []
  },
  async insertMany() {
    return
  },
}
