import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Snapshot } from '~/modules/tracking/domain/snapshot'

/**
 * Command to retrieve the latest snapshot for a container.
 */
export type GetLatestSnapshotCommand = {
  readonly containerId: string
}

/**
 * Result — the latest snapshot, or null if none exists.
 */
export type GetLatestSnapshotResult = Snapshot | null

/**
 * Get the most recent snapshot for a container.
 */
export async function getLatestSnapshot(
  deps: TrackingUseCasesDeps,
  cmd: GetLatestSnapshotCommand,
): Promise<GetLatestSnapshotResult> {
  return deps.snapshotRepository.findLatestByContainerId(cmd.containerId)
}
