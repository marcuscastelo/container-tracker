import type {
  InsertProcessRecord,
  UpdateProcessRecord,
  UpdateProcessWorkflowRecord,
} from '~/modules/process/application/process.records'
import type { ProcessRepository } from '~/modules/process/application/process.repository'
import type { ProcessEntity } from '~/modules/process/domain/process.entity'

import { processMappers } from '~/modules/process/infrastructure/persistence/process.persistence.mappers'
import { supabase } from '~/shared/supabase/supabase'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'

// src/modules/process/infrastructure/persistence/supabaseProcessRepository.ts
const PROCESSES_TABLE = 'processes'

export const supabaseProcessRepository: ProcessRepository = {
  async fetchAll(): Promise<readonly ProcessEntity[]> {
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

  async fetchById(processId: string): Promise<ProcessEntity | null> {
    const result = await supabase.from(PROCESSES_TABLE).select('*').eq('id', processId).single()
    const row = unwrapSupabaseSingleOrNull(result, {
      operation: 'fetchById',
      table: PROCESSES_TABLE,
    })
    return row ? processMappers.rowToProcess(row) : null
  },

  async create(record: InsertProcessRecord): Promise<ProcessEntity> {
    const now = new Date().toISOString()

    const insertRow = processMappers.insertRecordToRow(record, now)

    const result = await supabase.from(PROCESSES_TABLE).insert(insertRow).select().single()

    const row = unwrapSupabaseResultOrThrow(result, { operation: 'create', table: PROCESSES_TABLE })
    return processMappers.rowToProcess(row)
  },

  async update(processId: string, record: UpdateProcessRecord): Promise<ProcessEntity> {
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

  async updateWorkflowState(
    processId: string,
    record: UpdateProcessWorkflowRecord,
  ): Promise<ProcessEntity> {
    const now = new Date().toISOString()

    const result = await supabase
      .from(PROCESSES_TABLE)
      .update({
        operational_workflow_state: record.operational_workflow_state,
        updated_at: now,
      })
      .eq('id', processId)
      .select()
      .single()

    const row = unwrapSupabaseResultOrThrow(result, {
      operation: 'updateWorkflowState',
      table: PROCESSES_TABLE,
    })
    return processMappers.rowToProcess(row)
  },
}
