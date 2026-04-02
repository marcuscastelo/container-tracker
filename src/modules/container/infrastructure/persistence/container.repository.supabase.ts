import type { ContainerRepository } from '~/modules/container/application/container.repository'
import type { ContainerEntity } from '~/modules/container/domain/container.entity'
import { containerMappers } from '~/modules/container/infrastructure/persistence/container.persistence.mappers'
import type { Database } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'

const TABLE_NAME: keyof Database['public']['Tables'] = 'containers'

export const supabaseContainerRepository: ContainerRepository = {
  async findByNumber(containerNumber: string): Promise<ContainerEntity | null> {
    const result = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('container_number', containerNumber)
      .limit(1)
      .maybeSingle()

    const data = unwrapSupabaseSingleOrNull(result, {
      operation: 'findByNumber',
      table: TABLE_NAME,
    })

    if (!data) return null

    return containerMappers.fromRow(data)
  },

  async insert(record): Promise<ContainerEntity> {
    const row = containerMappers.toInsert(record)

    const result = await supabase.from(TABLE_NAME).insert(row).select().single()
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'insert',
      table: TABLE_NAME,
    })

    return containerMappers.fromRow(data)
  },

  async insertMany(records): Promise<ContainerEntity[]> {
    if (records.length === 0) return []

    const rows = records.map(containerMappers.toInsert)

    const result = await supabase.from(TABLE_NAME).insert(rows).select()
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'insertMany',
      table: TABLE_NAME,
    })

    return data.map(containerMappers.fromRow)
  },

  async update(record): Promise<ContainerEntity> {
    const row = containerMappers.toUpdate(record)

    const result = await supabase.from(TABLE_NAME).update(row).eq('id', record.id).select().single()
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'update',
      table: TABLE_NAME,
    })

    return containerMappers.fromRow(data)
  },

  async existsMany(containerNumbers: string[]): Promise<Map<string, boolean>> {
    if (containerNumbers.length === 0) {
      return new Map()
    }

    const normalized = containerNumbers.map((n) => n.toUpperCase().trim())

    const result = await supabase
      .from(TABLE_NAME)
      .select('container_number')
      .in('container_number', normalized)

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'existsMany',
      table: TABLE_NAME,
    })

    const existingSet = new Set(data.map((row) => row.container_number.toUpperCase().trim()))

    return new Map(normalized.map((num) => [num, existingSet.has(num)]))
  },

  async findByNumbers(containerNumbers: string[]): Promise<ContainerEntity[]> {
    if (containerNumbers.length === 0) return []

    const normalized = containerNumbers.map((n) => n.toUpperCase().trim())

    const result = await supabase.from(TABLE_NAME).select('*').in('container_number', normalized)

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findByNumbers',
      table: TABLE_NAME,
    })

    return data.map(containerMappers.fromRow)
  },

  async listSearchProjections() {
    const result = await supabase
      .from(TABLE_NAME)
      .select('process_id, container_number')
      .order('created_at', { ascending: true })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'listSearchProjections',
      table: TABLE_NAME,
    })

    return data.map((row) => ({
      processId: row.process_id,
      containerNumber: row.container_number,
    }))
  },

  async delete(containerId: string): Promise<void> {
    const result = await supabase.from(TABLE_NAME).delete().eq('id', containerId)
    // Throw only on real errors; allow null/empty delete result
    unwrapSupabaseSingleOrNull(result, { operation: 'delete', table: TABLE_NAME })
  },

  async listByProcessId(processId: string): Promise<readonly ContainerEntity[]> {
    const result = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('process_id', processId)
      .order('created_at', { ascending: true })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'listByProcessId',
      table: TABLE_NAME,
    })

    return data.map(containerMappers.fromRow)
  },

  async listByProcessIds(
    processIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly ContainerEntity[]>> {
    if (processIds.length === 0) {
      return new Map()
    }

    const result = await supabase
      .from(TABLE_NAME)
      .select('*')
      .in('process_id', [...processIds])
      .order('created_at', { ascending: true })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'listByProcessIds',
      table: TABLE_NAME,
    })

    const grouped = new Map<string, ContainerEntity[]>()
    for (const pid of processIds) {
      grouped.set(pid, [])
    }
    for (const row of data) {
      const entity = containerMappers.fromRow(row)
      const list = grouped.get(row.process_id)
      if (list) {
        list.push(entity)
      } else {
        // This should not happen since we initialized the map with all processIds, but just in case:
        grouped.set(row.process_id, [entity])
      }
    }

    return grouped
  },
}
