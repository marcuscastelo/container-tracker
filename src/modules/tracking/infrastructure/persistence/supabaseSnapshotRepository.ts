import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/snapshot'
import { SnapshotSchema } from '~/modules/tracking/domain/snapshot'
import type { SnapshotRepository } from '~/modules/tracking/domain/snapshotRepository'
import { toJson } from '~/modules/tracking/infrastructure/persistence/toJson'
import type { Tables } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import type { SupabaseNullableResult, SupabaseResult } from '~/shared/supabase/supabaseResult'
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
  async insert(snapshot: NewSnapshot): Promise<SupabaseResult<Snapshot>> {
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
      console.error('supabaseSnapshotRepository.insert error:', error)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to insert snapshot: ${error.message}`, { cause: error }),
      }
    }

    const parsed = rowToSnapshot(data)
    if (!parsed.success) {
      console.error('supabaseSnapshotRepository.insert: invalid row', parsed.error)
      return { success: false, data: null, error: parsed.error }
    }
    return { success: true, data: parsed.data, error: null }
  },

  async findLatestByContainerId(containerId: string): Promise<SupabaseNullableResult<Snapshot>> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('supabaseSnapshotRepository.findLatestByContainerId error:', error)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to fetch latest snapshot: ${error.message}`, { cause: error }),
      }
    }

    if (!data) return { success: true, data: null, error: null }
    const parsed = rowToSnapshot(data)
    if (!parsed.success) {
      console.error('supabaseSnapshotRepository.findLatestByContainerId: invalid row', parsed.error)
      return { success: false, data: null, error: parsed.error }
    }
    return { success: true, data: parsed.data, error: null }
  },

  async findAllByContainerId(containerId: string): Promise<SupabaseResult<readonly Snapshot[]>> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .order('fetched_at', { ascending: false })

    if (error) {
      console.error('supabaseSnapshotRepository.findAllByContainerId error:', error)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to fetch snapshots: ${error.message}`, { cause: error }),
      }
    }

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

    return { success: true, data: mapped, error: null }
  },
}
