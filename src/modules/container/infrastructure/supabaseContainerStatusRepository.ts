import type { ContainerStatus } from '~/modules/container/domain/containerStatus'
import type { ContainerStatusRepository } from '~/modules/container/domain/containerStatusRepository'
import type { Json } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import { isRecord } from '~/shared/utils/typeGuards'

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
        const r = isRecord(row) ? row : {}
        const cid = r?.container_id
          ? String(r.container_id)
          : String(row?.container_id ?? 'unknown')
        const status = r?.raw_payload ?? r?.raw ?? r ?? {}

        // Basic runtime shape checks
        if (typeof cid !== 'string' || cid.length === 0) {
          console.warn(
            'supabaseContainerStatusRepository.fetchAll: invalid container_id, falling back',
            row,
          )
        }

        return {
          container_id: cid,
          carrier: String(row?.carrier_code ?? 'UNKNOWN'),
          status: isRecord(status) ? status : {},
        }
      } catch (e) {
        console.warn(
          'supabaseContainerStatusRepository.fetchAll: failed to normalize row',
          row,
          String(e),
        )
        return {
          container_id: String(row?.container_id ?? 'unknown'),
          carrier: String(row?.carrier_code ?? 'UNKNOWN'),
          status: isRecord(row?.raw_payload) ? row.raw_payload : {},
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
      const rec = isRecord(d) ? d : {}
      const cid = rec?.container_id ? String(rec.container_id) : containerId
      const status = rec?.raw_payload ?? rec ?? {}
      return {
        container_id: cid,
        carrier: String(rec?.carrier_code ?? rec?.carrier ?? 'UNKNOWN'),
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
        raw_payload: containerStatus.status,
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
    const stat = isRecord(first?.raw_payload) ? first.raw_payload : {}
    return {
      container_id: first.container_id,
      carrier: String(first?.carrier_code ?? 'UNKNOWN'),
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
