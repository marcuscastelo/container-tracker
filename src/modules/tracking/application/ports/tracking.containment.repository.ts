import type {
  ActivateTrackingContainmentCommand,
  TrackingContainmentState,
} from '~/modules/tracking/features/containment/domain/model/trackingContainment'

export type TrackingContainmentRepository = {
  findActiveByContainerId(containerId: string): Promise<TrackingContainmentState | null>
  findActiveByContainerIds(
    containerIds: readonly string[],
  ): Promise<ReadonlyMap<string, TrackingContainmentState>>
  activate(command: ActivateTrackingContainmentCommand): Promise<void>
}

export const noopTrackingContainmentRepository: TrackingContainmentRepository = {
  async findActiveByContainerId() {
    return null
  },
  async findActiveByContainerIds() {
    return new Map()
  },
  async activate() {
    return
  },
}
