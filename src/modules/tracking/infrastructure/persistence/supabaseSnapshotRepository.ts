import type { SnapshotRepository } from '~/modules/tracking/application/tracking.snapshot.repository'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/snapshot'
import {
  snapshotRowToDomain,
  snapshotToInsertRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mappers'
import { supabase } from '~/shared/supabase/supabase'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'

const TABLE = 'container_snapshots' as const

export const supabaseSnapshotRepository: SnapshotRepository = {
  async insert(snapshot: NewSnapshot): Promise<Snapshot> {
    const result = await supabase
      .from(TABLE)
      .insert(snapshotToInsertRow(snapshot))
      .select('*')
      .single()

    const data = unwrapSupabaseResultOrThrow(result, { operation: 'insert', table: TABLE })
    return snapshotRowToDomain(data)
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
    return snapshotRowToDomain(data)
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

    return (data ?? []).map(snapshotRowToDomain)
  },
}
