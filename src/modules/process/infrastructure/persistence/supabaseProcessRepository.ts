import type {
  InsertProcessRecord,
  UpdateProcessRecord,
} from '~/modules/process/application/process.records'
import type { ProcessRepository } from '~/modules/process/application/process.repository'
import type { Process } from '~/modules/process/domain/process'
import type { ProcessContainer, ProcessWithContainers } from '~/modules/process/domain/processStuff'
import { processMappers } from '~/modules/process/infrastructure/persistence/process.persistence.mappers'
import { supabase } from '~/shared/supabase/supabase'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'

// src/modules/process/infrastructure/persistence/supabaseProcessRepository.ts
const PROCESSES_TABLE = 'processes'
const CONTAINERS_TABLE = 'containers'

export const supabaseProcessRepository: ProcessRepository = {
  async fetchAll(): Promise<readonly Process[]> {
    const result = await supabase
      .from(PROCESSES_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
    const rows = unwrapSupabaseResultOrThrow(result, {
      operation: 'fetchAll',
      table: PROCESSES_TABLE,
    })
    return rows.map(processMappers.rowToProcess)
  },

  async fetchAllWithContainers(): Promise<readonly ProcessWithContainers[]> {
    const result = await supabase
      .from(PROCESSES_TABLE)
      .select(`*, ${CONTAINERS_TABLE}(*)`)
      .order('created_at', { ascending: false })

    const combinedRows = unwrapSupabaseResultOrThrow(result, {
      operation: 'fetchAllWithContainers',
      table: PROCESSES_TABLE,
    })

    return combinedRows.map((row) => processMappers.rowToProcessWithContainers(row, row.containers))
  },

  async fetchById(processId: string): Promise<Process | null> {
    const result = await supabase.from(PROCESSES_TABLE).select('*').eq('id', processId).single()
    const row = unwrapSupabaseSingleOrNull(result, {
      operation: 'fetchById',
      table: PROCESSES_TABLE,
    })
    return row ? processMappers.rowToProcess(row) : null
  },

  async fetchByIdWithContainers(processId: string): Promise<ProcessWithContainers | null> {
    const result = await supabase
      .from(PROCESSES_TABLE)
      .select(`*, ${CONTAINERS_TABLE}(*)`)
      .eq('id', processId)
      .single()

    const combinedRow = unwrapSupabaseSingleOrNull(result, {
      operation: 'fetchByIdWithContainers',
      table: PROCESSES_TABLE,
    })
    return combinedRow
      ? processMappers.rowToProcessWithContainers(combinedRow, combinedRow.containers)
      : null
  },

  async fetchContainersByProcessId(processId: string): Promise<readonly ProcessContainer[]> {
    const result = await supabase
      .from(CONTAINERS_TABLE)
      .select('*')
      .eq('process_id', processId)
      .order('created_at', { ascending: true })

    const rows = unwrapSupabaseResultOrThrow(result, {
      operation: 'fetchContainersByProcessId',
      table: CONTAINERS_TABLE,
    })
    return rows.map(processMappers.rowToContainer)
  },

  async containerExists(containerNumber: string): Promise<boolean> {
    const normalized = containerNumber.toUpperCase().trim()
    const result = await supabase
      .from(CONTAINERS_TABLE)
      .select('id')
      .eq('container_number', normalized)
      .limit(1)

    const rows = unwrapSupabaseResultOrThrow(result, {
      operation: 'containerExists',
      table: CONTAINERS_TABLE,
    })
    return rows.length > 0
  },

  async fetchContainerByNumber(containerNumber: string): Promise<ProcessContainer | null> {
    const normalized = containerNumber.toUpperCase().trim()
    const result = await supabase
      .from(CONTAINERS_TABLE)
      .select('*')
      .eq('container_number', normalized)
      .limit(1)

    const rows = unwrapSupabaseResultOrThrow(result, {
      operation: 'fetchContainerByNumber',
      table: CONTAINERS_TABLE,
    })
    if (rows.length === 0) return null
    return processMappers.rowToContainer(rows[0])
  },

  async create(record: InsertProcessRecord): Promise<Process> {
    const now = new Date().toISOString()

    const insertRow = processMappers.insertRecordToRow(record, now)

    const result = await supabase.from(PROCESSES_TABLE).insert(insertRow).select().single()

    const row = unwrapSupabaseResultOrThrow(result, { operation: 'create', table: PROCESSES_TABLE })
    return processMappers.rowToProcess(row)
  },

  async update(processId: string, record: UpdateProcessRecord): Promise<Process> {
    const now = new Date().toISOString()

    const updateRow = processMappers.updateRecordToRow(record, now)

    const result = await supabase
      .from(PROCESSES_TABLE)
      .update(updateRow)
      .eq('id', processId)
      .select()
      .single()

    const row = unwrapSupabaseResultOrThrow(result, { operation: 'update', table: PROCESSES_TABLE })
    return processMappers.rowToProcess(row)
  },

  async delete(processId: string): Promise<void> {
    const result = await supabase.from(PROCESSES_TABLE).delete().eq('id', processId)
    unwrapSupabaseSingleOrNull(result, { operation: 'delete', table: PROCESSES_TABLE })
  },

  async removeContainer(containerId: string): Promise<void> {
    const result = await supabase.from(CONTAINERS_TABLE).delete().eq('id', containerId)
    unwrapSupabaseSingleOrNull(result, { operation: 'removeContainer', table: CONTAINERS_TABLE })
  },
}
