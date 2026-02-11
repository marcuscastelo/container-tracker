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

  async delete(containerId: string): Promise<void> {
    const result = await supabase.from(TABLE_NAME).delete().eq('id', containerId)
    // Throw only on real errors; allow null/empty delete result
    unwrapSupabaseSingleOrNull(result, { operation: 'delete', table: TABLE_NAME })
  },
}
