import type {
  PlannedLocation,
  Process,
  ProcessContainer,
  ProcessWithContainers,
} from '~/modules/shipment/domain/process'
import type { ProcessRepository } from '~/modules/shipment/domain/processRepository'
import type { Json } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'

const PROCESSES_TABLE = 'processes'
const CONTAINERS_TABLE = 'process_containers'

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
      const containers = ((row as Record<string, unknown>)[CONTAINERS_TABLE] as unknown[]) ?? []
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
    const containers = ((data as Record<string, unknown>)[CONTAINERS_TABLE] as unknown[]) ?? []
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

    if (!data || (data as unknown[]).length === 0) return null
    return rowToContainer((data as unknown[])[0])
  },

  async create(
    process: Omit<Process, 'id' | 'created_at' | 'updated_at'>,
    containers: readonly Omit<
      ProcessContainer,
      'id' | 'process_id' | 'created_at' | 'updated_at'
    >[],
  ): Promise<ProcessWithContainers> {
    const now = new Date().toISOString()
    const { data: processData, error: processError } = await supabase
      .from(PROCESSES_TABLE)
      .insert({
        reference: process.reference,
        operation_type: process.operation_type,
        origin: process.origin as unknown as Json,
        destination: process.destination as unknown as Json,
        carrier: process.carrier,
        bl_reference: process.bl_reference,
        booking_reference: process.booking_reference,
        source: process.source,
        created_at: now,
        updated_at: now,
      })
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

    const containerInserts = containers.map((c) => ({
      process_id: createdProcess.id,
      container_number: c.container_number.toUpperCase().trim(),
      iso_type: c.iso_type,
      initial_status: c.initial_status,
      source: c.source,
      created_at: now,
      updated_at: now,
    }))

    const { data: containersData, error: containersError } = await supabase
      .from(CONTAINERS_TABLE)
      .insert(containerInserts)
      .select()

    if (containersError) {
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
        iso_type: container.iso_type,
        initial_status: container.initial_status,
        source: container.source,
        created_at: now,
        updated_at: now,
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
        origin: updates.origin as unknown as Json,
        destination: updates.destination as unknown as Json,
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

function rowToProcess(row: unknown): Process {
  const r = row as Record<string, unknown>
  return {
    id: String(r.id),
    reference: r.reference as string | null,
    operation_type: (r.operation_type as Process['operation_type']) ?? 'unknown',
    origin: r.origin as PlannedLocation | null,
    destination: r.destination as PlannedLocation | null,
    carrier: r.carrier as Process['carrier'] | null,
    bl_reference: r.bl_reference as string | null,
    booking_reference: r.booking_reference as string | null,
    source: (r.source as Process['source']) ?? 'manual',
    created_at: new Date(r.created_at as string),
    updated_at: new Date(r.updated_at as string),
  }
}

function rowToContainer(row: unknown): ProcessContainer {
  const r = row as Record<string, unknown>
  return {
    id: String(r.id),
    process_id: String(r.process_id),
    container_number: String(r.container_number),
    iso_type: r.iso_type as string | null,
    initial_status: (r.initial_status as ProcessContainer['initial_status']) ?? 'unknown',
    source: (r.source as ProcessContainer['source']) ?? 'manual',
    created_at: new Date(r.created_at as string),
    updated_at: new Date(r.updated_at as string),
  }
}
