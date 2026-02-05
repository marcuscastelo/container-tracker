import type { ContainerStatus } from '~/modules/container/domain/containerStatus'
import type { ContainerStatusRepository } from '~/modules/container/domain/containerStatusRepository'
import type { Json } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import { isRecord } from '~/shared/utils/typeGuards'

function safeGet(obj: unknown, key: string): unknown {
  if (!isRecord(obj)) return undefined
  return obj[key]
}

// Recursively coerce arbitrary unknown -> Json (best-effort). This avoids unsafe casts
function toJson(v: unknown): import('~/shared/supabase/database.types').Json {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v
  if (Array.isArray(v)) return v.map((x) => toJson(x))
  if (typeof v === 'object') {
    const out: Record<string, import('~/shared/supabase/database.types').Json | undefined> = {}
    if (isRecord(v)) {
      for (const [k, val] of Object.entries(v)) {
        out[k] = toJson(val)
      }
    }
    return out
  }
  return String(v)
}

const TABLE_NAME = 'container_tracking_snapshots'

/**
 * Supabase-backed implementation of ContainerStatusRepository.
 * Uses the `container_tracking_snapshots` table (append-only) and exposes a simple
 * adapter that maps latest snapshot.raw_payload -> ContainerStatus. This keeps the
 * old repository interface while persisting canonical payloads as snapshots.
 */
export const supabaseContainerStatusRepository: ContainerStatusRepository = {
  async fetchAll(): Promise<readonly ContainerStatus[]> {
    // Return latest snapshot per container_id (best-effort): select all snapshots and map
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('fetched_at', { ascending: false })

    if (error) {
      console.error('supabaseContainerStatusRepository.fetchAll error:', error)
      throw new Error(`Failed to fetch container statuses: ${error.message}`)
    }

    return data.map((row) => {
      try {
        const cid =
          typeof safeGet(row, 'container_id') === 'string'
            ? String(safeGet(row, 'container_id'))
            : String(safeGet(row, 'container_id') ?? 'unknown')
        const status = safeGet(row, 'raw_payload') ?? safeGet(row, 'raw') ?? row ?? {}

        // Basic runtime shape checks
        if (typeof cid !== 'string' || cid.length === 0) {
          console.warn(
            'supabaseContainerStatusRepository.fetchAll: invalid container_id, falling back',
            row,
          )
        }

        return {
          container_id: cid,
          carrier: String(safeGet(row, 'carrier_code') ?? 'UNKNOWN'),
          status: isRecord(status) ? status : {},
        }
      } catch (e) {
        console.warn(
          'supabaseContainerStatusRepository.fetchAll: failed to normalize row',
          row,
          String(e),
        )
        const payload = safeGet(row, 'raw_payload')
        const statusVal = isRecord(payload) ? payload : {}
        return {
          container_id: String(safeGet(row, 'container_id') ?? 'unknown'),
          carrier: String(safeGet(row, 'carrier_code') ?? 'UNKNOWN'),
          status: statusVal,
        }
      }
    })
  },

  async fetchById(containerId: string): Promise<ContainerStatus | null> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('container_id', containerId)
      .order('fetched_at', { ascending: false })
      .limit(1)

    if (error) {
      // PGRST116 = no rows found, which is not an error for us
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('supabaseContainerStatusRepository.fetchById error:', error)
      throw new Error(`Failed to fetch container status for ${containerId}: ${error.message}`)
    }

    if (!data) return null

    try {
      const d = Array.isArray(data) ? data[0] : data
      const rec = isRecord(d) ? d : undefined
      const cid = rec?.['container_id'] ? String(rec['container_id']) : containerId
      const status = rec?.['raw_payload'] ?? rec ?? {}
      return {
        container_id: cid,
        carrier: String(safeGet(rec, 'carrier_code') ?? safeGet(rec, 'carrier') ?? 'UNKNOWN'),
        status: isRecord(status) ? status : {},
      }
    } catch (e) {
      console.warn(
        'supabaseContainerStatusRepository.fetchById: failed to normalize data',
        data,
        String(e),
      )
      return null
    }
  },

  async upsert(containerStatus: ContainerStatus): Promise<ContainerStatus> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        container_id: containerStatus.container_id,
        carrier_code: containerStatus.carrier,
        fetched_at: new Date().toISOString(),
        raw_payload: toJson(containerStatus.status),
      })
      .select()

    if (error) {
      console.error('supabaseContainerStatusRepository.upsert error:', error)
      throw new Error(
        `Failed to upsert container status for ${containerStatus.container_id}: ${error.message}`,
      )
    }

    if (!data) {
      throw new Error(`Insert returned no data for ${containerStatus.container_id}`)
    }

    const first = Array.isArray(data) ? data[0] : data
    const stat = isRecord(first?.['raw_payload']) ? first['raw_payload'] : {}
    return {
      container_id: first['container_id'],
      carrier: String(first?.['carrier_code'] ?? 'UNKNOWN'),
      status: stat,
    }
  },

  async delete(containerId: string): Promise<void> {
    const { error } = await supabase.from(TABLE_NAME).delete().eq('container_id', containerId)

    if (error) {
      console.error('supabaseContainerStatusRepository.delete error:', error)
      throw new Error(`Failed to delete container status for ${containerId}: ${error.message}`)
    }
  },
}
