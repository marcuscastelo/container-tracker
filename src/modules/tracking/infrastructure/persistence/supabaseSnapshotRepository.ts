import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/snapshot'
import { SnapshotSchema } from '~/modules/tracking/domain/snapshot'
import type { SnapshotRepository } from '~/modules/tracking/domain/snapshotRepository'
import { fromUntypedTable } from '~/modules/tracking/infrastructure/persistence/supabaseUntypedTable'

// Table name — will be created by the user in Supabase.
// Expected columns:
//   id: uuid (PK, default gen_random_uuid())
//   container_id: uuid (FK to containers)
//   provider: text
//   fetched_at: timestamptz
//   payload: jsonb
//   parse_error: text nullable
const TABLE = 'container_snapshots'

type SnapshotRow = {
  readonly id: string
  readonly container_id: string
  readonly provider: string
  readonly fetched_at: string
  readonly payload: unknown
  readonly parse_error: string | null
}

function rowToSnapshot(row: unknown): Snapshot {
  const r = row as SnapshotRow // TODO: Replace with Zod parse once table types are generated
  const result = SnapshotSchema.safeParse({
    id: r.id,
    container_id: r.container_id,
    provider: r.provider,
    fetched_at: r.fetched_at,
    payload: r.payload,
    parse_error: r.parse_error,
  })

  if (!result.success) {
    throw new Error(`Invalid snapshot row: ${JSON.stringify(result.error)}`)
  }

  return result.data
}

export const supabaseSnapshotRepository: SnapshotRepository = {
  async insert(snapshot: NewSnapshot): Promise<Snapshot> {
    const { data, error } = await fromUntypedTable(TABLE)
      .insert({
        container_id: snapshot.container_id,
        provider: snapshot.provider,
        fetched_at: snapshot.fetched_at,
        payload: snapshot.payload,
        parse_error: snapshot.parse_error ?? null,
      })
      .select('*')
      .single()

    if (error) {
      throw new Error(`Failed to insert snapshot: ${error.message}`)
    }

    return rowToSnapshot(data)
  },

  async findLatestByContainerId(containerId: string): Promise<Snapshot | null> {
    const { data, error } = await fromUntypedTable(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch latest snapshot: ${error.message}`)
    }

    return data ? rowToSnapshot(data) : null
  },

  async findAllByContainerId(containerId: string): Promise<readonly Snapshot[]> {
    const { data, error } = await fromUntypedTable(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .order('fetched_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch snapshots: ${error.message}`)
    }

    return ((data ?? []) as unknown[]).map(rowToSnapshot)
  },
}
