import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'

/**
 * Command to retrieve all snapshots for a container.
 */
export type GetSnapshotsForContainerCommand = {
  readonly containerId: string
}

/**
 * Result — ordered list of snapshots.
 */
export type GetSnapshotsForContainerResult = readonly Snapshot[]

/**
 * Get all snapshots for a container, ordered by fetched_at desc.
 */
export async function getSnapshotsForContainer(
  deps: TrackingUseCasesDeps,
  cmd: GetSnapshotsForContainerCommand,
): Promise<GetSnapshotsForContainerResult> {
  return deps.snapshotRepository.findAllByContainerId(cmd.containerId)
}
