import { z } from 'zod/v4'
import type { SyncQueuePort } from '~/capabilities/sync/application/ports/sync-queue.port'
import type { SyncStatusReadPort } from '~/capabilities/sync/application/ports/sync-status-read.port'
import type { SyncTargetReadPort } from '~/capabilities/sync/application/ports/sync-target-read.port'
import type { RefreshProcessDeps } from '~/capabilities/sync/application/usecases/refresh-process.usecase'
import { bootstrapSyncControllers } from '~/capabilities/sync/interface/http/sync.controllers.bootstrap'
import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import { serverEnv } from '~/shared/config/server-env'
import { supabaseServer } from '~/shared/supabase/supabase.server'
import { unwrapSupabaseResultOrThrow } from '~/shared/supabase/unwrapSupabaseResult'

const ActiveProcessIdRowSchema = z.object({
  id: z.string(),
})

const ActiveProcessIdRowsSchema = z.array(ActiveProcessIdRowSchema)

const ProcessSyncCandidateRowSchema = z.object({
  id: z.string(),
  archived_at: z.string().nullable(),
})

const ProcessSyncCandidateRowsSchema = z.array(ProcessSyncCandidateRowSchema)

const EnqueueSyncRequestRowSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['PENDING', 'LEASED']),
  is_new: z.boolean(),
})

const EnqueueSyncRequestRowsSchema = z.array(EnqueueSyncRequestRowSchema).min(1)

const SyncStatusRowSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['PENDING', 'LEASED', 'DONE', 'FAILED']),
  last_error: z.string().nullable(),
  updated_at: z.string(),
  ref_value: z.string(),
})

const SyncStatusRowsSchema = z.array(SyncStatusRowSchema)

const SyncStatusByContainerRowSchema = z.object({
  ref_value: z.string(),
  status: z.enum(['PENDING', 'LEASED', 'DONE', 'FAILED']),
  created_at: z.string(),
  updated_at: z.string(),
})

const SyncStatusByContainerRowsSchema = z.array(SyncStatusByContainerRowSchema)

function toPriority(mode: 'manual' | 'live' | 'backfill'): number {
  if (mode === 'live') return 1
  if (mode === 'backfill') return -1
  return 0
}

const targetReadPort: SyncTargetReadPort = {
  async fetchProcessById(command) {
    const result = await processUseCases.findProcessById({
      processId: command.processId,
    })

    if (!result.process) return null

    return {
      id: result.process.id,
    }
  },

  async listActiveProcessIds() {
    const result = await supabaseServer
      .from('processes')
      .select('id')
      .is('archived_at', null)
      .is('deleted_at', null)

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'list_active_process_ids',
      table: 'processes',
    })

    const rows = ActiveProcessIdRowsSchema.parse(data)
    return rows.map((row) => row.id)
  },

  async listContainersByProcessId(command) {
    const result = await containerUseCases.listByProcessId({
      processId: command.processId,
    })

    return {
      containers: result.containers.map((container) => ({
        processId: String(container.processId),
        containerNumber: String(container.containerNumber),
        carrierCode: container.carrierCode ? String(container.carrierCode) : null,
      })),
    }
  },

  async listContainersByProcessIds(command) {
    const result = await containerUseCases.listByProcessIds({
      processIds: command.processIds,
    })

    const containersByProcessId = new Map<
      string,
      readonly {
        readonly processId: string
        readonly containerNumber: string
        readonly carrierCode: string | null
      }[]
    >()

    for (const [processId, containers] of result.containersByProcessId.entries()) {
      containersByProcessId.set(
        processId,
        containers.map((container) => ({
          processId,
          containerNumber: String(container.containerNumber),
          carrierCode: container.carrierCode ? String(container.carrierCode) : null,
        })),
      )
    }

    return { containersByProcessId }
  },

  async findContainersByNumber(command) {
    const result = await containerUseCases.findByNumbers({
      containerNumbers: [command.containerNumber],
    })

    return {
      containers: result.containers.map((container) => ({
        processId: String(container.processId),
        containerNumber: String(container.containerNumber),
        carrierCode: container.carrierCode ? String(container.carrierCode) : null,
      })),
    }
  },
}

const queuePort: SyncQueuePort = {
  async enqueueContainerSyncRequest(command) {
    const result = await supabaseServer.rpc('enqueue_sync_request', {
      p_tenant_id: command.tenantId,
      p_provider: command.provider,
      p_ref_type: 'container',
      p_ref_value: command.containerNumber.toUpperCase().trim(),
      p_priority: toPriority(command.mode),
    })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'enqueue_sync_request',
      table: 'sync_requests',
    })

    const parsed = EnqueueSyncRequestRowsSchema.parse(data)
    const row = parsed[0]

    return {
      id: row.id,
      status: row.status,
      isNew: row.is_new,
    }
  },

  async getSyncRequestStatuses(command) {
    const uniqueSyncRequestIds = Array.from(new Set(command.syncRequestIds))
    if (uniqueSyncRequestIds.length === 0) {
      return {
        allTerminal: true,
        requests: [],
      }
    }

    const result = await supabaseServer
      .from('sync_requests')
      .select('id,status,last_error,updated_at,ref_value')
      .eq('tenant_id', serverEnv.SYNC_DEFAULT_TENANT_ID)
      .in('id', uniqueSyncRequestIds)

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'get_sync_request_statuses_for_sync_capability',
      table: 'sync_requests',
    })

    const rows = SyncStatusRowsSchema.parse(data)
    const byId = new Map(rows.map((row) => [row.id, row]))

    const requests = command.syncRequestIds.map((syncRequestId) => {
      const row = byId.get(syncRequestId)
      if (!row) {
        return {
          syncRequestId,
          status: 'NOT_FOUND' as const,
          lastError: 'sync_request_not_found',
          updatedAt: null,
          refValue: null,
        }
      }

      return {
        syncRequestId: row.id,
        status: row.status,
        lastError: row.last_error,
        updatedAt: row.updated_at,
        refValue: row.ref_value,
      }
    })

    const allTerminal = requests.every((request) => {
      return (
        request.status === 'DONE' || request.status === 'FAILED' || request.status === 'NOT_FOUND'
      )
    })

    return {
      allTerminal,
      requests,
    }
  },
}

const statusReadPort: SyncStatusReadPort = {
  async listProcessSyncCandidates() {
    const result = await supabaseServer
      .from('processes')
      .select('id,archived_at')
      .is('deleted_at', null)

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'list_process_sync_candidates',
      table: 'processes',
    })

    const rows = ProcessSyncCandidateRowsSchema.parse(data)
    return rows.map((row) => ({
      processId: row.id,
      archivedAt: row.archived_at,
    }))
  },

  async listContainersByProcessIds(command) {
    const result = await targetReadPort.listContainersByProcessIds(command)

    const containersByProcessId = new Map<string, readonly { readonly containerNumber: string }[]>()
    for (const [processId, containers] of result.containersByProcessId.entries()) {
      containersByProcessId.set(
        processId,
        containers.map((container) => ({
          containerNumber: container.containerNumber,
        })),
      )
    }

    return {
      containersByProcessId,
    }
  },

  async listSyncRequestsByContainerNumbers(command) {
    const normalizedContainerNumbers = Array.from(
      new Set(
        command.containerNumbers
          .map((containerNumber) => containerNumber.toUpperCase().trim())
          .filter((containerNumber) => containerNumber.length > 0),
      ),
    )

    if (normalizedContainerNumbers.length === 0) {
      return []
    }

    const result = await supabaseServer
      .from('sync_requests')
      .select('ref_value,status,created_at,updated_at')
      .eq('tenant_id', serverEnv.SYNC_DEFAULT_TENANT_ID)
      .eq('ref_type', 'container')
      .in('ref_value', normalizedContainerNumbers)

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'list_sync_requests_by_container_numbers',
      table: 'sync_requests',
    })

    const rows = SyncStatusByContainerRowsSchema.parse(data)
    return rows.map((row) => ({
      containerNumber: row.ref_value.toUpperCase().trim(),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  },
}

const refreshProcessDeps: RefreshProcessDeps = {
  async fetchProcessById(command) {
    return targetReadPort.fetchProcessById(command)
  },

  async listContainersByProcessId(command) {
    const result = await targetReadPort.listContainersByProcessId(command)
    return {
      containers: result.containers.map((container) => ({
        containerNumber: container.containerNumber,
        carrierCode: container.carrierCode,
      })),
    }
  },

  async enqueueContainerSyncRequest(command) {
    return queuePort.enqueueContainerSyncRequest({
      tenantId: serverEnv.SYNC_DEFAULT_TENANT_ID,
      mode: 'manual',
      provider: command.provider,
      containerNumber: command.containerNumber,
    })
  },
}

const bootstrappedSyncControllers = bootstrapSyncControllers({
  targetReadPort,
  queuePort,
  statusReadPort,
  refreshProcessDeps,
  defaultTenantId: serverEnv.SYNC_DEFAULT_TENANT_ID,
})

export const syncControllers = bootstrappedSyncControllers.syncControllers
export const syncStatusControllers = bootstrappedSyncControllers.syncStatusControllers
