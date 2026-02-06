import type { NewProcess, Process } from '~/modules/process/domain/process'
import type { ProcessContainer, ProcessWithContainers } from '~/modules/process/domain/processStuff'
import type {
  Carrier,
  OperationType,
  PlannedLocation,
  ProcessSourceSchema,
} from '~/modules/process/domain/value-objects'
import { processMappers } from '~/modules/process/infrastructure/persistence/processMapper'
import type { Database, Json } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import type { SupabaseResult } from '~/shared/supabase/supabaseResult'

const PROCESSES_TABLE = 'processes'
const CONTAINERS_TABLE = 'containers'

// TODO: Use SupabaseResult
/**
 * Supabase-backed implementation of ProcessRepository.
 * Uses the `processes` and `process_containers` tables.
 */
export const supabaseProcessRepository = {
  async fetchAll(): Promise<readonly Process[]> {
    const { data, error } = await supabase
      .from(PROCESSES_TABLE)
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('supabaseProcessRepository.fetchAll error:', error)
      throw new Error(`Failed to fetch processes: ${error.message}`)
    }

    return data.map(processMappers.rowToProcess)
  },

  async fetchAllWithContainers(): Promise<readonly ProcessWithContainers[]> {
    const { data, error } = await supabase
      .from(PROCESSES_TABLE)
      .select(`*, ${CONTAINERS_TABLE}(*)`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('supabaseProcessRepository.fetchAllWithContainers error:', error)
      throw new Error(`Failed to fetch processes with containers: ${error.message}`)
    }

    return data.map((row) => {
      const process = processMappers.rowToProcess(row)
      const containers = row[CONTAINERS_TABLE] ?? []
      return {
        ...process,
        containers: containers.map(processMappers.rowToContainer),
      }
    })
  },

  async fetchById(processId: string): Promise<Process | null> {
    const { data, error } = await supabase
      .from(PROCESSES_TABLE)
      .select('*')
      .eq('id', processId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      console.error('supabaseProcessRepository.fetchById error:', error)
      throw new Error(`Failed to fetch process ${processId}: ${error.message}`)
    }

    return processMappers.rowToProcess(data)
  },

  async fetchByIdWithContainers(processId: string): Promise<ProcessWithContainers | null> {
    const { data, error } = await supabase
      .from(PROCESSES_TABLE)
      .select(`*, ${CONTAINERS_TABLE}(*)`)
      .eq('id', processId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      console.error('supabaseProcessRepository.fetchByIdWithContainers error:', error)
      throw new Error(`Failed to fetch process ${processId}: ${error.message}`)
    }

    if (!data) return null

    const process = processMappers.rowToProcess(data)
    const containers = data[CONTAINERS_TABLE] ?? []
    return {
      ...process,
      containers: containers.map(processMappers.rowToContainer),
    }
  },

  async fetchContainersByProcessId(processId: string): Promise<readonly ProcessContainer[]> {
    const { data, error } = await supabase
      .from(CONTAINERS_TABLE)
      .select('*')
      .eq('process_id', processId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('supabaseProcessRepository.fetchContainersByProcessId error:', error)
      throw new Error(`Failed to fetch containers for process ${processId}: ${error.message}`)
    }

    return data.map(processMappers.rowToContainer)
  },

  async containerExists(containerNumber: string): Promise<boolean> {
    const normalized = containerNumber.toUpperCase().trim()
    const { data, error } = await supabase
      .from(CONTAINERS_TABLE)
      .select('id')
      .eq('container_number', normalized)
      .limit(1)

    if (error) {
      console.error('supabaseProcessRepository.containerExists error:', error)
      throw new Error(`Failed to check container existence: ${error.message}`)
    }

    return (data?.length ?? 0) > 0
  },

  async fetchContainerByNumber(containerNumber: string): Promise<ProcessContainer | null> {
    const normalized = containerNumber.toUpperCase().trim()
    const { data, error } = await supabase
      .from(CONTAINERS_TABLE)
      .select('*')
      .eq('container_number', normalized)
      .limit(1)

    if (error) {
      console.error('supabaseProcessRepository.fetchContainerByNumber error:', error)
      throw new Error(`Failed to fetch container by number: ${error.message}`)
    }

    if (!data || data.length === 0) return null
    return processMappers.rowToContainer(data[0])
  },

  async create(process: NewProcess): Promise<SupabaseResult<Process>> {
    // Create process first
    const now = new Date().toISOString()
    const { data: processData, error: processError } = await supabase
      .from(PROCESSES_TABLE)
      .insert({
        reference: process.reference,
        operation_type: process.operation_type,
        origin: process.origin ?? null,
        destination: process.destination ?? null,
        carrier: process.carrier,
        bill_of_lading: process.bill_of_lading,
        booking_reference: process.booking_reference,
        source: process.source,
        created_at: now,
        updated_at: now,
      } satisfies Database['public']['Tables']['processes']['Insert'])
      .select()
      .single()

    if (processError) {
      console.error('supabaseProcessRepository.create process error:', processError)
      throw new Error(`Failed to create process: ${processError.message}`)
    }

    if (!processData) {
      throw new Error('Failed to create process: no data returned')
    }

    return { success: true, data: processMappers.rowToProcess(processData), error: null }
  },

  async update(
    processId: string,
    updates: Partial<Omit<Process, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Process> {
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
      throw new Error(`Failed to update process ${processId}: ${error.message}`)
    }

    return processMappers.rowToProcess(data)
  },

  async delete(processId: string): Promise<void> {
    // Containers are deleted via cascade in the database
    const { error } = await supabase.from(PROCESSES_TABLE).delete().eq('id', processId)

    if (error) {
      console.error('supabaseProcessRepository.delete error:', error)
      throw new Error(`Failed to delete process ${processId}: ${error.message}`)
    }
  },

  async removeContainer(containerId: string): Promise<void> {
    const { error } = await supabase.from(CONTAINERS_TABLE).delete().eq('id', containerId)

    if (error) {
      console.error('supabaseProcessRepository.removeContainer error:', error)
      throw new Error(`Failed to remove container ${containerId}: ${error.message}`)
    }
  },
}
