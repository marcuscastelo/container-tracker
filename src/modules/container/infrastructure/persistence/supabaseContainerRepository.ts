import type { Container, NewContainer } from '~/modules/container/domain/container'
import { containerMappers } from '~/modules/container/infrastructure/persistence/containerMapper'
import type { Database } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import type { SupabaseResult } from '~/shared/supabase/supabaseResult'

const TABLE_NAME: keyof Database['public']['Tables'] = 'containers'

export const supabaseContainerRepository = {
  async findByNumber(containerNumber: string): Promise<SupabaseResult<Container>> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('container_number', containerNumber)
      .limit(1)
      .single()

    if (error) {
      console.error(`Error fetching container ${containerNumber} from supabase:`, error)
      return { success: false, data: null, error }
    }

    return { success: true, data: containerMappers.fromRow(data), error: null }
  },

  async insert(container: NewContainer): Promise<SupabaseResult<Container>> {
    const row = containerMappers.toInsert(container)
    const { data, error } = await supabase.from(TABLE_NAME).insert(row).select().single()
    if (error) {
      console.error(`Error upserting container ${container.container_number} into supabase:`, error)
      return { success: false, data: null, error }
    }

    console.log(
      `Successfully inserted container ${container.container_number} into supabase:`,
      data,
    )
    return { success: true, data: containerMappers.fromRow(data), error: null }
  },

  async insertMany(containers: NewContainer[]): Promise<SupabaseResult<Container[]>> {
    const rows = containers.map(containerMappers.toInsert)
    const { data, error } = await supabase.from(TABLE_NAME).insert(rows).select()
    if (error) {
      console.error(`Error inserting multiple containers into supabase:`, error)
      return { success: false, data: null, error }
    }

    console.log(`Successfully inserted multiple containers into supabase:`, data)
    return { success: true, data: data.map(containerMappers.fromRow), error: null }
  },

  async existsMany(containerNumbers: string[]): Promise<SupabaseResult<Map<string, boolean>>> {
    if (containerNumbers.length === 0) {
      return { success: true, data: new Map(), error: null }
    }

    const normalized = containerNumbers.map((n) => n.toUpperCase().trim())
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('container_number')
      .in('container_number', normalized)

    if (error) {
      console.error(`Error checking container existence in batch:`, error)
      return { success: false, data: null, error }
    }

    const existingSet = new Set(data.map((row) => row.container_number.toUpperCase().trim()))
    const resultMap = new Map<string, boolean>()
    for (const num of normalized) {
      resultMap.set(num, existingSet.has(num))
    }

    return { success: true, data: resultMap, error: null }
  },

  async findByNumbers(containerNumbers: string[]): Promise<SupabaseResult<Container[]>> {
    if (containerNumbers.length === 0) {
      return { success: true, data: [], error: null }
    }

    const normalized = containerNumbers.map((n) => n.toUpperCase().trim())
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .in('container_number', normalized)

    if (error) {
      console.error(`Error finding containers by numbers:`, error)
      return { success: false, data: null, error }
    }

    return { success: true, data: data.map(containerMappers.fromRow), error: null }
  },

  async delete(containerId: string): Promise<SupabaseResult<object>> {
    const { error } = await supabase.from(TABLE_NAME).delete().eq('id', containerId)

    if (error) {
      console.error(`Error deleting container ${containerId}:`, error)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to delete container: ${error.message}`, { cause: error }),
      }
    }

    return { success: true, data: {}, error: null }
  },
}
