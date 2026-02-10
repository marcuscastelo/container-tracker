import type { NewProcess, Process } from '~/modules/process/domain/process'
import type { ProcessContainer, ProcessWithContainers } from '~/modules/process/domain/processStuff'
import { processMappers } from '~/modules/process/infrastructure/persistence/processMapper'
import type { Database } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import type { SupabaseNullableResult, SupabaseResult } from '~/shared/supabase/supabaseResult'

const PROCESSES_TABLE = 'processes'
const CONTAINERS_TABLE = 'containers'

// TODO: Use SupabaseResult
/**
 * Supabase-backed implementation of ProcessRepository.
 * Uses the `processes` and `process_containers` tables.
 */
export const supabaseProcessRepository = {
  async fetchAll(): Promise<SupabaseResult<readonly Process[]>> {
    const { data, error } = await supabase
      .from(PROCESSES_TABLE)
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('supabaseProcessRepository.fetchAll error:', error)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to fetch processes: ${error.message}`, { cause: error }),
      }
    }

    return { success: true, data: data.map(processMappers.rowToProcess), error: null }
  },

  async fetchAllWithContainers(): Promise<SupabaseResult<readonly ProcessWithContainers[]>> {
    const { data, error } = await supabase
      .from(PROCESSES_TABLE)
      .select(`*, ${CONTAINERS_TABLE}(*)`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('supabaseProcessRepository.fetchAllWithContainers error:', error)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to fetch processes with containers: ${error.message}`, {
          cause: error,
        }),
      }
    }

    const result = data.map((row) => {
      const process = processMappers.rowToProcess(row)
      const containers = row[CONTAINERS_TABLE] ?? []
      return {
        ...process,
        containers: containers.map(processMappers.rowToContainer),
      }
    })
    return { success: true, data: result, error: null }
  },

  async fetchById(processId: string): Promise<SupabaseNullableResult<Process>> {
    const { data, error } = await supabase
      .from(PROCESSES_TABLE)
      .select('*')
      .eq('id', processId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, data: null, error: null }
      }
      console.error('supabaseProcessRepository.fetchById error:', error)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to fetch process ${processId}: ${error.message}`, {
          cause: error,
        }),
      }
    }

    return { success: true, data: processMappers.rowToProcess(data), error: null }
  },

  async fetchByIdWithContainers(
    processId: string,
  ): Promise<SupabaseNullableResult<ProcessWithContainers>> {
    const { data, error } = await supabase
      .from(PROCESSES_TABLE)
      .select(`*, ${CONTAINERS_TABLE}(*)`)
      .eq('id', processId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, data: null, error: null }
      }
      console.error('supabaseProcessRepository.fetchByIdWithContainers error:', error)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to fetch process ${processId}: ${error.message}`, {
          cause: error,
        }),
      }
    }

    if (!data) return { success: true, data: null, error: null }

    const process = processMappers.rowToProcess(data)
    const containers = data[CONTAINERS_TABLE] ?? []
    return {
      success: true,
      data: {
        ...process,
        containers: containers.map(processMappers.rowToContainer),
      },
      error: null,
    }
  },

  async fetchContainersByProcessId(
    processId: string,
  ): Promise<SupabaseResult<readonly ProcessContainer[]>> {
    const { data, error } = await supabase
      .from(CONTAINERS_TABLE)
      .select('*')
      .eq('process_id', processId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('supabaseProcessRepository.fetchContainersByProcessId error:', error)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to fetch containers for process ${processId}: ${error.message}`, {
          cause: error,
        }),
      }
    }

    return { success: true, data: data.map(processMappers.rowToContainer), error: null }
  },

  async containerExists(containerNumber: string): Promise<SupabaseResult<boolean>> {
    const normalized = containerNumber.toUpperCase().trim()
    const { data, error } = await supabase
      .from(CONTAINERS_TABLE)
      .select('id')
      .eq('container_number', normalized)
      .limit(1)

    if (error) {
      console.error('supabaseProcessRepository.containerExists error:', error)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to check container existence: ${error.message}`, { cause: error }),
      }
    }

    return { success: true, data: (data?.length ?? 0) > 0, error: null }
  },

  async fetchContainerByNumber(
    containerNumber: string,
  ): Promise<SupabaseNullableResult<ProcessContainer>> {
    const normalized = containerNumber.toUpperCase().trim()
    const { data, error } = await supabase
      .from(CONTAINERS_TABLE)
      .select('*')
      .eq('container_number', normalized)
      .limit(1)

    if (error) {
      console.error('supabaseProcessRepository.fetchContainerByNumber error:', error)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to fetch container by number: ${error.message}`, { cause: error }),
      }
    }

    if (!data || data.length === 0) return { success: true, data: null, error: null }
    return { success: true, data: processMappers.rowToContainer(data[0]), error: null }
  },

  async create(process: NewProcess): Promise<SupabaseResult<Process>> {
    // Create process first
    const now = new Date().toISOString()
    const { data: processData, error: processError } = await supabase
      .from(PROCESSES_TABLE)
      .insert({
        reference: process.reference,
        origin: process.origin ?? null,
        destination: process.destination ?? null,
        carrier: process.carrier,
        bill_of_lading: process.bill_of_lading,
        booking_number: process.booking_number,
        importer_name: process.importer_name,
        exporter_name: process.exporter_name,
        reference_importer: process.reference_importer,
        product: process.product ?? null,
        redestination_number: process.redestination_number ?? null,
        source: process.source,
        created_at: now,
        updated_at: now,
      } satisfies Database['public']['Tables']['processes']['Insert'])
      .select()
      .single()

    if (processError) {
      console.error('supabaseProcessRepository.create process error:', processError)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to create process: ${processError.message}`, {
          cause: processError,
        }),
      }
    }

    if (!processData) {
      return {
        success: false,
        data: null,
        error: new Error('Failed to create process: no data returned'),
      }
    }

    return { success: true, data: processMappers.rowToProcess(processData), error: null }
  },

  async update(
    processId: string,
    updates: Partial<Omit<Process, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<SupabaseResult<Process>> {
    const { data, error } = await supabase
      .from(PROCESSES_TABLE)
      .update({
        ...updates,
        origin: updates.origin ?? null,
        destination: updates.destination ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', processId)
      .select()
      .single()

    if (error) {
      console.error('supabaseProcessRepository.update error:', error)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to update process ${processId}: ${error.message}`, {
          cause: error,
        }),
      }
    }

    return { success: true, data: processMappers.rowToProcess(data), error: null }
  },

  async delete(processId: string): Promise<SupabaseResult<object>> {
    // Containers are deleted via cascade in the database
    const { error } = await supabase.from(PROCESSES_TABLE).delete().eq('id', processId)

    if (error) {
      console.error('supabaseProcessRepository.delete error:', error)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to delete process ${processId}: ${error.message}`, {
          cause: error,
        }),
      }
    }
    return { success: true, data: {}, error: null }
  },
  async removeContainer(containerId: string): Promise<SupabaseResult<object>> {
    const { error } = await supabase.from(CONTAINERS_TABLE).delete().eq('id', containerId)

    if (error) {
      console.error('supabaseProcessRepository.removeContainer error:', error)
      return {
        success: false,
        data: null,
        error: new Error(`Failed to remove container ${containerId}: ${error.message}`, {
          cause: error,
        }),
      }
    }

    return { success: true, data: {}, error: null }
  },
}
