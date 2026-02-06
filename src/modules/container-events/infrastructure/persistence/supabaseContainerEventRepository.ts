import type { ContainerEvent } from '~/modules/container-events/domain/ContainerEvent'
import { containerEventMappers } from '~/modules/container-events/infrastructure/persistence/containerEventMappers'
import type { Database } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import type { SupabaseResult } from '~/shared/supabase/supabaseResult'

const TABLE_NAME: keyof Database['public']['Tables'] = 'container-events'

export const supabaseContainerEventRepository = {
  async findByContainer(containerNumber: string): Promise<SupabaseResult<ContainerEvent[]>> {
    console.log(`Fetching events for container ${containerNumber} from supabase`)

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('container_number', containerNumber)
      .order('event_time', { ascending: true })

    if (error) {
      // TODO: better error handling - maybe throw an error or return a Result type instead of just logging and returning empty array
      console.error(`Error fetching events for container ${containerNumber} from supabase:`, error)
      return { success: false, data: null, error }
    }

    console.log(`Successfully fetched events for container ${containerNumber} from supabase:`, data)
    return { success: true, data: containerEventMappers.fromRows(data ?? []), error: null }
  },

  async insertMany(events: ContainerEvent[]): Promise<SupabaseResult<{ status: string }>> {
    console.log('Inserting events into supabase:', events)

    const { data, error } = await supabase.from(TABLE_NAME).insert(events)

    if (error) {
      console.error('Error inserting events into supabase:', error)
      return { success: false, data: null, error }
    }

    console.log('Successfully inserted events into supabase:', data)
    return { success: true, data: { status: 'success' }, error: null }
  },
}
