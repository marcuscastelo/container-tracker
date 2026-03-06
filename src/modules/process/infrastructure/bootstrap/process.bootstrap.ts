// src/modules/process/process.bootstrap.ts
//
// Composition root for the Process module.
// Wires repositories + cross-module UseCases, and exports ProcessUseCases.
// No business logic here.

import { z } from 'zod/v4'
import {
  type ContainerUseCases,
  createContainerUseCases,
} from '~/modules/container/application/container.usecases'
import { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/container.repository.supabase'
import type { ContainerUseCasesForProcess } from '~/modules/process/application/process.container-usecases'
import {
  type CreateProcessUseCasesDeps,
  createProcessUseCases,
} from '~/modules/process/application/process.usecases'
import type { SyncAllProcessesDeps } from '~/modules/process/application/usecases/sync-all-processes.usecase'
import { supabaseProcessRepository } from '~/modules/process/infrastructure/persistence/supabaseProcessRepository'
import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'
import { serverEnv } from '~/shared/config/server-env'
import { supabaseServer } from '~/shared/supabase/supabase.server'
import { unwrapSupabaseResultOrThrow } from '~/shared/supabase/unwrapSupabaseResult'

const ActiveProcessIdRowSchema = z.object({
  id: z.string(),
})

const ActiveProcessIdRowsSchema = z.array(ActiveProcessIdRowSchema)

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

async function sleep(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs)
  })
}

function pickContainerUseCasesForProcess(all: ContainerUseCases): ContainerUseCasesForProcess {
  return {
    checkExistence: all.checkExistence,
    createManyForProcess: all.createManyForProcess,
    reconcileForProcess: all.reconcileForProcess,
    deleteContainer: all.deleteContainer,
    findByNumbers: all.findByNumbers,
    listByProcessId: all.listByProcessId,
    listByProcessIds: all.listByProcessIds,
  }
}

// Container module wiring (owned by container module)
const containerUseCases = createContainerUseCases({ repository: supabaseContainerRepository })

// Restrict dependency surface: Process only sees what it needs from Container
const containerDepsForProcess = pickContainerUseCasesForProcess(containerUseCases)

// Tracking module wiring (for operational summary aggregation)
const { trackingUseCases } = bootstrapTrackingModule()

const syncAllProcessesDeps: SyncAllProcessesDeps = {
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
  listContainersByProcessIds(command) {
    return containerDepsForProcess.listByProcessIds(command)
  },
  async enqueueContainerSyncRequest(command) {
    const result = await supabaseServer.rpc('enqueue_sync_request', {
      p_tenant_id: serverEnv.SYNC_DEFAULT_TENANT_ID,
      p_provider: command.provider,
      p_ref_type: 'container',
      p_ref_value: command.containerNumber.toUpperCase().trim(),
      p_priority: 0,
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
      operation: 'get_sync_request_statuses_for_process_sync',
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
  nowMs: Date.now,
  sleep,
}

const deps: CreateProcessUseCasesDeps = {
  repository: supabaseProcessRepository,
  containerUseCases: containerDepsForProcess,
  trackingUseCases,
  syncAllProcessesDeps,
}

export const processUseCases = createProcessUseCases(deps)
