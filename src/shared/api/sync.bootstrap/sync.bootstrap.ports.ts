import { z } from 'zod/v4'
import type { SyncQueuePort } from '~/capabilities/sync/application/ports/sync-queue.port'
import type { SyncStatusReadPort } from '~/capabilities/sync/application/ports/sync-status-read.port'
import type { SyncTargetReadPort } from '~/capabilities/sync/application/ports/sync-target-read.port'
import type { RefreshProcessDeps } from '~/capabilities/sync/application/usecases/refresh-process.usecase'
import { normalizeProcessIdsScope } from '~/capabilities/sync/application/utils/normalizeProcessIdsScope'
import { serverEnv } from '~/shared/config/server-env'
import { supabaseServer } from '~/shared/supabase/supabase.server'
import { unwrapSupabaseResultOrThrow } from '~/shared/supabase/unwrapSupabaseResult'

type ProcessUseCasesDeps = {
  readonly findProcessById: (command: { readonly processId: string }) => Promise<{
    readonly process: {
      readonly id: string
      readonly carrierMode?: 'AUTO' | 'MANUAL'
      readonly defaultCarrierCode?: string | null
      readonly lastResolvedCarrierCode?: string | null
      readonly carrierResolvedAt?: Date | null
    } | null
  }>
}

type ContainerUseCasesDeps = {
  readonly listByProcessId: (command: { readonly processId: string }) => Promise<{
    readonly containers: readonly {
      readonly id: string
      readonly processId: string
      readonly containerNumber: string
      readonly carrierCode: string | null
      readonly carrierAssignmentMode?: 'AUTO' | 'MANUAL'
      readonly carrierDetectedAt?: Date | null
      readonly carrierDetectionSource?:
        | 'process-seed'
        | 'auto-detect'
        | 'manual-user'
        | 'legacy-backfill'
        | null
    }[]
  }>
  readonly listByProcessIds: (command: { readonly processIds: readonly string[] }) => Promise<{
    readonly containersByProcessId: ReadonlyMap<
      string,
      readonly {
        readonly id: string
        readonly processId: string
        readonly containerNumber: string
        readonly carrierCode: string | null
        readonly carrierAssignmentMode?: 'AUTO' | 'MANUAL'
        readonly carrierDetectedAt?: Date | null
        readonly carrierDetectionSource?:
          | 'process-seed'
          | 'auto-detect'
          | 'manual-user'
          | 'legacy-backfill'
          | null
      }[]
    >
  }>
  readonly findByNumbers: (command: { readonly containerNumbers: string[] }) => Promise<{
    readonly containers: readonly {
      readonly id: string
      readonly processId: string
      readonly containerNumber: string
      readonly carrierCode: string | null
      readonly carrierAssignmentMode?: 'AUTO' | 'MANUAL'
      readonly carrierDetectedAt?: Date | null
      readonly carrierDetectionSource?:
        | 'process-seed'
        | 'auto-detect'
        | 'manual-user'
        | 'legacy-backfill'
        | null
    }[]
  }>
}

type CreateSyncPortsDeps = {
  readonly processUseCases: ProcessUseCasesDeps
  readonly containerUseCases: ContainerUseCasesDeps
}

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

const PROCESS_SYNC_RECENT_ARCHIVE_WINDOW_DAYS = 7

function toPriority(mode: 'manual' | 'live' | 'backfill'): number {
  if (mode === 'live') return 1
  if (mode === 'backfill') return -1
  return 0
}

function getRecentArchivedProcessCutoff(now: Date): string {
  return new Date(
    now.getTime() - PROCESS_SYNC_RECENT_ARCHIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()
}

function toOptionalIsoString(
  value: { readonly toISOString: () => string } | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return value.toISOString()
}

function toSyncTargetContainerRecord(container: {
  readonly id: string | number
  readonly processId: string | number
  readonly containerNumber: string
  readonly carrierCode: string | null
  readonly carrierAssignmentMode?: 'AUTO' | 'MANUAL'
  readonly carrierDetectedAt?: { readonly toISOString: () => string } | null
  readonly carrierDetectionSource?:
    | 'process-seed'
    | 'auto-detect'
    | 'manual-user'
    | 'legacy-backfill'
    | null
}) {
  const carrierDetectedAt = toOptionalIsoString(container.carrierDetectedAt)

  return {
    id: String(container.id),
    processId: String(container.processId),
    containerNumber: String(container.containerNumber),
    carrierCode: container.carrierCode ? String(container.carrierCode) : null,
    ...(container.carrierAssignmentMode !== undefined
      ? { carrierAssignmentMode: container.carrierAssignmentMode }
      : {}),
    ...(carrierDetectedAt !== undefined ? { carrierDetectedAt } : {}),
    ...(container.carrierDetectionSource !== undefined
      ? { carrierDetectionSource: container.carrierDetectionSource ?? null }
      : {}),
  }
}

export function createSyncTargetReadPort(deps: CreateSyncPortsDeps): SyncTargetReadPort {
  return {
    async fetchProcessById(command) {
      const result = await deps.processUseCases.findProcessById({
        processId: command.processId,
      })

      if (!result.process) return null

      const carrierResolvedAt = toOptionalIsoString(result.process.carrierResolvedAt)

      return {
        id: result.process.id,
        ...(result.process.carrierMode !== undefined
          ? { carrierMode: result.process.carrierMode }
          : {}),
        ...(result.process.defaultCarrierCode !== undefined
          ? { defaultCarrierCode: result.process.defaultCarrierCode }
          : {}),
        ...(result.process.lastResolvedCarrierCode !== undefined
          ? { lastResolvedCarrierCode: result.process.lastResolvedCarrierCode }
          : {}),
        ...(carrierResolvedAt !== undefined ? { carrierResolvedAt } : {}),
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
      const result = await deps.containerUseCases.listByProcessId({
        processId: command.processId,
      })

      return {
        containers: result.containers.map((container) => toSyncTargetContainerRecord(container)),
      }
    },

    async listContainersByProcessIds(command) {
      const result = await deps.containerUseCases.listByProcessIds({
        processIds: command.processIds,
      })

      const containersByProcessId = new Map<
        string,
        readonly {
          readonly id: string
          readonly processId: string
          readonly containerNumber: string
          readonly carrierCode: string | null
          readonly carrierAssignmentMode?: 'AUTO' | 'MANUAL'
          readonly carrierDetectedAt?: string | null
          readonly carrierDetectionSource?:
            | 'process-seed'
            | 'auto-detect'
            | 'manual-user'
            | 'legacy-backfill'
            | null
        }[]
      >()

      for (const [processId, containers] of result.containersByProcessId.entries()) {
        containersByProcessId.set(
          processId,
          containers.map((container) =>
            toSyncTargetContainerRecord({
              ...container,
              processId,
            }),
          ),
        )
      }

      return { containersByProcessId }
    },

    async findContainersByNumber(command) {
      const result = await deps.containerUseCases.findByNumbers({
        containerNumbers: [command.containerNumber],
      })

      return {
        containers: result.containers.map((container) => toSyncTargetContainerRecord(container)),
      }
    },
  }
}

export function createSyncQueuePort(deps: { readonly defaultTenantId: string }): SyncQueuePort {
  return {
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
      if (row === undefined) {
        throw new Error('enqueue_sync_request returned no rows')
      }

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
        .eq('tenant_id', deps.defaultTenantId)
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
}

export function createSyncStatusReadPort(deps: {
  readonly targetReadPort: SyncTargetReadPort
  readonly defaultTenantId: string
  readonly nowFactory?: () => Date
}): SyncStatusReadPort {
  const nowFactory = deps.nowFactory ?? (() => new Date())

  return {
    async listProcessSyncCandidates(command = {}) {
      const scopedProcessIds = normalizeProcessIdsScope(command.processIds)
      if (command.processIds && scopedProcessIds.length === 0) {
        return []
      }

      let query = supabaseServer.from('processes').select('id,archived_at').is('deleted_at', null)

      if (scopedProcessIds.length > 0) {
        query = query.in('id', scopedProcessIds)
      } else {
        query = query.or(
          `archived_at.is.null,archived_at.gt.${getRecentArchivedProcessCutoff(nowFactory())}`,
        )
      }

      const result = await query

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
      const result = await deps.targetReadPort.listContainersByProcessIds(command)

      const containersByProcessId = new Map<
        string,
        readonly { readonly containerNumber: string }[]
      >()
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
        .eq('tenant_id', deps.defaultTenantId)
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
}

export function createRefreshProcessDeps(deps: {
  readonly targetReadPort: SyncTargetReadPort
  readonly queuePort: SyncQueuePort
  readonly defaultTenantId: string
}): RefreshProcessDeps {
  return {
    async fetchProcessById(command) {
      return deps.targetReadPort.fetchProcessById(command)
    },

    async listContainersByProcessId(command) {
      const result = await deps.targetReadPort.listContainersByProcessId(command)
      return {
        containers: result.containers.map((container) => ({
          containerNumber: container.containerNumber,
          carrierCode: container.carrierCode,
        })),
      }
    },

    async enqueueContainerSyncRequest(command) {
      return deps.queuePort.enqueueContainerSyncRequest({
        tenantId: deps.defaultTenantId,
        mode: 'manual',
        provider: command.provider,
        containerNumber: command.containerNumber,
      })
    },
  }
}

export function resolveDefaultTenantId(): string {
  return serverEnv.SYNC_DEFAULT_TENANT_ID
}
