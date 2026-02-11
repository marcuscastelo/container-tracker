import type { NewProcess, Process } from '~/modules/process/domain/process'
import type { ProcessContainer, ProcessWithContainers } from '~/modules/process/domain/processStuff'
import { processMappers } from '~/modules/process/infrastructure/persistence/process.persistence.mappers'
import { InfrastructureError } from '~/shared/errors/httpErrors'
import type { Database } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'

const PROCESSES_TABLE = 'processes'
const CONTAINERS_TABLE = 'containers'

/**
 * Supabase-backed implementation of ProcessRepository.
 * Uses the `processes` and `process_containers` tables.
 */
export const supabaseProcessRepository = {
  async fetchAll(): Promise<readonly Process[]> {
    const result = await supabase
      .from(PROCESSES_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'fetchAll',
      table: PROCESSES_TABLE,
    })
    if (!data) return []
    return data.map((row) => processMappers.rowToProcess(row))
  },

  async fetchAllWithContainers(): Promise<readonly ProcessWithContainers[]> {
    const result = await supabase
      .from(PROCESSES_TABLE)
      .select(`*, ${CONTAINERS_TABLE}(*)`)
      .order('created_at', { ascending: false })
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'fetchAllWithContainers',
      table: PROCESSES_TABLE,
    })
    if (!data) return []
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
    const result = await supabase.from(PROCESSES_TABLE).select('*').eq('id', processId).single()
    const data = unwrapSupabaseSingleOrNull(result, {
      operation: 'fetchById',
      table: PROCESSES_TABLE,
    })
    if (!data) return null
    return processMappers.rowToProcess(data)
  },

  async fetchByIdWithContainers(processId: string): Promise<ProcessWithContainers | null> {
    const result = await supabase
      .from(PROCESSES_TABLE)
      .select(`*, ${CONTAINERS_TABLE}(*)`)
      .eq('id', processId)
      .single()
    const data = unwrapSupabaseSingleOrNull(result, {
      operation: 'fetchByIdWithContainers',
      table: PROCESSES_TABLE,
    })
    if (!data) return null

    const process = processMappers.rowToProcess(data)
    const containers = data[CONTAINERS_TABLE] ?? []
    return {
      ...process,
      containers: containers.map(processMappers.rowToContainer),
    }
  },

  async fetchContainersByProcessId(processId: string): Promise<readonly ProcessContainer[]> {
    const result = await supabase
      .from(CONTAINERS_TABLE)
      .select('*')
      .eq('process_id', processId)
      .order('created_at', { ascending: true })
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'fetchContainersByProcessId',
      table: CONTAINERS_TABLE,
    })
    if (!data) return []
    return data.map((row) => processMappers.rowToContainer(row))
  },

  async containerExists(containerNumber: string): Promise<boolean> {
    const normalized = containerNumber.toUpperCase().trim()
    const result = await supabase
      .from(CONTAINERS_TABLE)
      .select('id')
      .eq('container_number', normalized)
      .limit(1)
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'containerExists',
      table: CONTAINERS_TABLE,
    })
    return (data?.length ?? 0) > 0
  },

  async fetchContainerByNumber(containerNumber: string): Promise<ProcessContainer | null> {
    const normalized = containerNumber.toUpperCase().trim()
    const result = await supabase
      .from(CONTAINERS_TABLE)
      .select('*')
      .eq('container_number', normalized)
      .limit(1)
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'fetchContainerByNumber',
      table: CONTAINERS_TABLE,
    })
    if (!data || data.length === 0) return null
    return processMappers.rowToContainer(data[0])
  },

  async create(process: NewProcess): Promise<Process> {
    // Create process first
    const now = new Date().toISOString()
    const result = await supabase
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

    const processData = unwrapSupabaseResultOrThrow(result, {
      operation: 'create',
      table: PROCESSES_TABLE,
    })
    if (!processData) throw new InfrastructureError('Failed to create process: no data returned')
    return processMappers.rowToProcess(processData)
  },

  async update(
    processId: string,
    updates: Partial<Omit<Process, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Process> {
    const result = await supabase
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

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'update',
      table: PROCESSES_TABLE,
    })
    if (!data)
      throw new InfrastructureError(`Failed to update process ${processId}: no data returned`)
    return processMappers.rowToProcess(data)
  },

  async delete(processId: string): Promise<void> {
    // Containers are deleted via cascade in the database
    const result = await supabase.from(PROCESSES_TABLE).delete().eq('id', processId)
    // unwrap will throw on error but allow null/empty responses
    unwrapSupabaseSingleOrNull(result, { operation: 'delete', table: PROCESSES_TABLE })
  },
  async removeContainer(containerId: string): Promise<void> {
    const result = await supabase.from(CONTAINERS_TABLE).delete().eq('id', containerId)
    unwrapSupabaseSingleOrNull(result, { operation: 'removeContainer', table: CONTAINERS_TABLE })
  },
}
