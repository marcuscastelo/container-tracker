import type { SnapshotRepository } from '~/modules/tracking/application/tracking.snapshot.repository'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/snapshot'
import { SnapshotSchema } from '~/modules/tracking/domain/snapshot'
import { toJson } from '~/modules/tracking/infrastructure/persistence/toJson'
import type { Tables } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'
import { formatParseError } from '~/shared/utils/formatParseError'
import { normalizeTimestamptz } from '~/shared/utils/normalizeTimestamptz'

const TABLE = 'container_snapshots' as const

type SnapshotRow = Tables<'container_snapshots'>

function rowToSnapshot(
  row: SnapshotRow,
): { success: true; data: Snapshot } | { success: false; error: Error } {
  const fetchedAt = normalizeTimestamptz(row.fetched_at)

  const result = SnapshotSchema.safeParse({
    id: row.id,
    container_id: row.container_id,
    provider: row.provider,
    fetched_at: fetchedAt,
    payload: row.payload,
    parse_error: row.parse_error,
  })

  if (!result.success) {
    const err = new Error(`Invalid snapshot row:\n${formatParseError(result.error)}`)
    return { success: false, error: err }
  }

  return { success: true, data: result.data }
}
export const supabaseSnapshotRepository: SnapshotRepository = {
  async insert(snapshot: NewSnapshot): Promise<Snapshot> {
    const result = await supabase
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

    const data = unwrapSupabaseResultOrThrow(result, { operation: 'insert', table: TABLE })
    const parsed = rowToSnapshot(data)
    if (!parsed.success) {
      console.error('supabaseSnapshotRepository.insert: invalid row', parsed.error)
      throw parsed.error
    }
    return parsed.data
  },

  async findLatestByContainerId(containerId: string): Promise<Snapshot | null> {
    const result = await supabase
      .from(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const data = unwrapSupabaseSingleOrNull(result, {
      operation: 'findLatestByContainerId',
      table: TABLE,
    })
    if (!data) return null
    const parsed = rowToSnapshot(data)
    if (!parsed.success) {
      console.error('supabaseSnapshotRepository.findLatestByContainerId: invalid row', parsed.error)
      throw parsed.error
    }
    return parsed.data
  },

  async findAllByContainerId(containerId: string): Promise<readonly Snapshot[]> {
    const result = await supabase
      .from(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .order('fetched_at', { ascending: false })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findAllByContainerId',
      table: TABLE,
    })

    const mapped: Snapshot[] = []
    for (const row of data ?? []) {
      const parsed = rowToSnapshot(row)
      if (parsed.success) mapped.push(parsed.data)
      else
        console.error(
          'supabaseSnapshotRepository.findAllByContainerId: invalid row skipped',
          parsed.error,
        )
    }

    return mapped
  },
}
