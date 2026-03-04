import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/model/snapshot'

/**
 * Repository interface for Snapshot persistence.
 *
 * Snapshots are immutable and append-only.
 */
export type SnapshotRepository = {
  /** Persist a new snapshot. Returns the snapshot with generated id. */
  insert(snapshot: NewSnapshot): Promise<Snapshot>

  /** Fetch the most recent snapshot for a container. */
  findLatestByContainerId(containerId: string): Promise<Snapshot | null>

  /** Fetch all snapshots for a container, ordered by fetched_at desc. */
  findAllByContainerId(containerId: string): Promise<readonly Snapshot[]>

  /**
   * Fetch only specific snapshots for a container by id.
   * Optional to keep backwards compatibility with in-memory test doubles.
   */
  findByIds?(
    containerId: string,
    snapshotIds: readonly string[],
  ): Promise<readonly Snapshot[]>
}
