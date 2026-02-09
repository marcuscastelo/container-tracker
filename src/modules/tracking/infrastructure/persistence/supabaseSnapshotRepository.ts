import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/snapshot'
import { SnapshotSchema } from '~/modules/tracking/domain/snapshot'
import type { SnapshotRepository } from '~/modules/tracking/domain/snapshotRepository'
import { toJson } from '~/modules/tracking/infrastructure/persistence/toJson'
import type { Tables } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import { formatParseError } from '~/shared/utils/formatParseError'

const TABLE = 'container_snapshots' as const

type SnapshotRow = Tables<'container_snapshots'>

function rowToSnapshot(row: SnapshotRow): Snapshot {
  // The DB driver (Supabase) may return various representations for timestamptz
  // columns: JS Date, numeric epoch, or ISO-like strings. Our domain expects an
  // ISO datetime string (z.iso.datetime()). Normalize common types to an
  // ISO UTC string to make validation deterministic.
  function normalizeFetchedAt(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'number') return new Date(value).toISOString()
    if (typeof value === 'string') {
      // Try to parse the string — if it produces a valid Date, convert to ISO
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) return d.toISOString()
      // leave invalid strings as-is so the schema validation fails with a
      // helpful error message
      return value
    }
    return value
  }

  const fetchedAt = normalizeFetchedAt(row.fetched_at)

  const result = SnapshotSchema.safeParse({
    id: row.id,
    container_id: row.container_id,
    provider: row.provider,
    fetched_at: fetchedAt,
    payload: row.payload,
    parse_error: row.parse_error,
  })

  if (!result.success) {
    throw new Error(`Invalid snapshot row:\n${formatParseError(result.error)}`)
  }

  return result.data
}

export const supabaseSnapshotRepository: SnapshotRepository = {
  async insert(snapshot: NewSnapshot): Promise<Snapshot> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        container_id: snapshot.container_id,
        provider: snapshot.provider,
        fetched_at: snapshot.fetched_at,
        payload: toJson(snapshot.payload),
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
    const { data, error } = await supabase
      .from(TABLE)
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
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .order('fetched_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch snapshots: ${error.message}`)
    }

    return (data ?? []).map(rowToSnapshot)
  },
}
