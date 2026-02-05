import type { Process } from '~/modules/process/domain/process'
import type { ProcessRepository } from '~/modules/process/domain/processRepository'
import type { ProcessContainer, ProcessWithContainers } from '~/modules/process/domain/processStuff'
import type {
  Carrier,
  OperationType,
  PlannedLocation,
  ProcessSource,
} from '~/modules/process/domain/value-objects'
import type { Database, Json } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import { isRecord } from '~/shared/utils/typeGuards'

const PROCESSES_TABLE = 'processes'
const CONTAINERS_TABLE = 'containers'

type ProcessRow = Database['public']['Tables']['processes']['Row']
type ContainerRow = Database['public']['Tables']['containers']['Row']

/**
 * Supabase-backed implementation of ProcessRepository.
 * Uses the `processes` and `process_containers` tables.
 */
export const supabaseProcessRepository: ProcessRepository = {
  async fetchAll(): Promise<readonly Process[]> {
    const { data, error } = await supabase
      .from(PROCESSES_TABLE)
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('supabaseProcessRepository.fetchAll error:', error)
      throw new Error(`Failed to fetch processes: ${error.message}`)
    }

    return (data ?? []).map(rowToProcess)
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

    return (data ?? []).map((row) => {
      const process = rowToProcess(row)
      const containers = row[CONTAINERS_TABLE] ?? []
      return {
        ...process,
        containers: containers.map(rowToContainer),
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

    return data ? rowToProcess(data) : null
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

    const process = rowToProcess(data)
    const containers = data[CONTAINERS_TABLE] ?? []
    return {
      ...process,
      containers: containers.map(rowToContainer),
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

    return (data ?? []).map(rowToContainer)
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
    return rowToContainer(data[0])
  },

  async create(
    process: Omit<Process, 'id' | 'created_at' | 'updated_at'>,
    containers: readonly Omit<
      ProcessContainer,
      'id' | 'process_id' | 'created_at' | 'updated_at'
    >[],
  ): Promise<ProcessWithContainers> {
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

    const createdProcess = rowToProcess(processData)

    // Create containers
    const containerInserts = containers.map((c) => ({
      process_id: createdProcess.id,
      container_number: c.container_number.toUpperCase().trim(),
      carrier_code: c.carrier_code ?? null,
      container_type: c.container_type ?? null,
      container_size: c.container_size ?? null,
      created_at: now,
      removed_at: null,
    }))

    const { data: containersData, error: containersError } = await supabase
      .from(CONTAINERS_TABLE)
      .insert(containerInserts)
      .select()

    if (containersError) {
      // Rollback: delete the process
      await supabase.from(PROCESSES_TABLE).delete().eq('id', createdProcess.id)
      console.error('supabaseProcessRepository.create containers error:', containersError)
      throw new Error(`Failed to create containers: ${containersError.message}`)
    }

    return {
      ...createdProcess,
      containers: (containersData ?? []).map(rowToContainer),
    }
  },

  async addContainer(
    processId: string,
    container: Omit<ProcessContainer, 'id' | 'process_id' | 'created_at' | 'updated_at'>,
  ): Promise<ProcessContainer> {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from(CONTAINERS_TABLE)
      .insert({
        process_id: processId,
        container_number: container.container_number.toUpperCase().trim(),
        carrier_code: container.carrier_code ?? null,
        container_type: container.container_type ?? null,
        container_size: container.container_size ?? null,
        created_at: now,
        removed_at: null,
      })
      .select()
      .single()

    if (error) {
      console.error('supabaseProcessRepository.addContainer error:', error)
      throw new Error(`Failed to add container: ${error.message}`)
    }

    return rowToContainer(data)
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

    return rowToProcess(data)
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

// Helper functions to convert database rows to domain types
function rowToProcess(row: ProcessRow): Process {
  return {
    id: String(row.id),
    reference: row.reference == null ? null : String(row.reference),
    operation_type: <OperationType>(row.operation_type ?? 'unknown'), // FIXME: Replace assertion with proper parsing
    origin: isRecord(row.origin) ? row.origin : null,
    destination: isRecord(row.destination) ? row.destination : null,
    carrier: row.carrier == null ? null : <Carrier>String(row.carrier), // FIXME: Replace assertion with proper parsing
    bill_of_lading: row.bill_of_lading == null ? null : String(row.bill_of_lading),
    booking_reference: row.booking_reference == null ? null : String(row.booking_reference),
    source: <ProcessSource>row.source ?? 'manual', // FIXME: Replace assertion with proper parsing
    created_at: new Date(String(row.created_at)),
    updated_at: new Date(String(row.updated_at)),
  } satisfies Process
}

function rowToContainer(row: ContainerRow): ProcessContainer {
  return {
    id: String(row.id),
    process_id: String(row.process_id),
    container_number: String(row.container_number),
    carrier_code: row.carrier_code == null ? null : String(row.carrier_code),
    container_type: row.container_type == null ? null : String(row.container_type),
    container_size: row.container_size == null ? null : String(row.container_size),
    created_at: new Date(String(row.created_at)),
    removed_at: row.removed_at ? new Date(String(row.removed_at)) : null,
  }
}
