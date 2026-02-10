import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/snapshot'
import type { SupabaseResult } from '~/shared/supabase/supabaseResult'

/**
 * Repository interface for Snapshot persistence.
 *
 * Snapshots are immutable and append-only.
 */
export type SnapshotRepository = {
  /** Persist a new snapshot. Returns the snapshot with generated id. */
  insert(snapshot: NewSnapshot): Promise<SupabaseResult<Snapshot>>

  /** Fetch the most recent snapshot for a container. */
  findLatestByContainerId(containerId: string): Promise<SupabaseResult<Snapshot | null>>

  /** Fetch all snapshots for a container, ordered by fetched_at desc. */
  findAllByContainerId(containerId: string): Promise<SupabaseResult<readonly Snapshot[]>>
}
