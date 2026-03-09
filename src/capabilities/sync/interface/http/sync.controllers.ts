import type { SyncUseCases } from '~/capabilities/sync/application/sync.usecases'
import {
  ProcessRefreshRequestSchema,
  SyncContainerResponseSchema,
} from '~/capabilities/sync/interface/http/sync.schemas'
import {
  toProcessRefreshResponse,
  toSyncAllProcessesResponse,
  toSyncContainerResponse,
  toSyncProcessResponse,
} from '~/capabilities/sync/presenter/sync-response.presenter'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'
import {
  ProcessRefreshResponseSchema,
  SyncAllProcessesResponseSchema,
  SyncProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

type SyncControllersDeps = {
  readonly syncUseCases: Pick<
    SyncUseCases,
    'syncDashboard' | 'syncProcess' | 'syncContainer' | 'refreshProcess'
  >
  readonly defaultTenantId: string
}

let isSyncDashboardRunning = false
const syncingProcessIds = new Set<string>()
const syncingContainerNumbers = new Set<string>()

export function createSyncControllers(deps: SyncControllersDeps) {
  const { syncUseCases, defaultTenantId } = deps

  async function syncDashboard(): Promise<Response> {
    if (isSyncDashboardRunning || syncingProcessIds.size > 0 || syncingContainerNumbers.size > 0) {
      return jsonResponse({ error: 'sync_already_running' }, 409)
    }

    isSyncDashboardRunning = true
    try {
      const result = await syncUseCases.syncDashboard({
        tenantId: defaultTenantId,
        scope: { kind: 'dashboard' },
        mode: 'manual',
      })

      return jsonResponse(toSyncAllProcessesResponse(result), 200, SyncAllProcessesResponseSchema)
    } catch (err) {
      console.error('POST /api/dashboard/sync error:', err)
      return mapErrorToResponse(err)
    } finally {
      isSyncDashboardRunning = false
    }
  }

  // Legacy alias kept for backward-compatible HTTP contract.
  async function syncAllProcesses(): Promise<Response> {
    return syncDashboard()
  }

  async function syncProcessById({
    params,
  }: {
    readonly params: { readonly id?: string }
  }): Promise<Response> {
    const processId = params.id?.trim() ?? ''
    if (processId.length === 0) {
      return jsonResponse({ error: 'Process ID is required' }, 400)
    }

    if (isSyncDashboardRunning || syncingProcessIds.has(processId)) {
      return jsonResponse({ error: 'sync_already_running' }, 409)
    }

    syncingProcessIds.add(processId)
    try {
      const result = await syncUseCases.syncProcess({
        tenantId: defaultTenantId,
        scope: { kind: 'process', processId },
        mode: 'manual',
      })

      return jsonResponse(toSyncProcessResponse(result), 200, SyncProcessResponseSchema)
    } catch (err) {
      console.error(`POST /api/processes/${processId}/sync error:`, err)
      return mapErrorToResponse(err)
    } finally {
      syncingProcessIds.delete(processId)
    }
  }

  async function syncContainerByNumber({
    params,
  }: {
    readonly params: { readonly number?: string }
  }): Promise<Response> {
    const containerNumber = params.number?.trim().toUpperCase() ?? ''
    if (containerNumber.length === 0) {
      return jsonResponse({ error: 'Container number is required' }, 400)
    }

    if (isSyncDashboardRunning || syncingContainerNumbers.has(containerNumber)) {
      return jsonResponse({ error: 'sync_already_running' }, 409)
    }

    syncingContainerNumbers.add(containerNumber)
    try {
      const result = await syncUseCases.syncContainer({
        tenantId: defaultTenantId,
        scope: { kind: 'container', containerNumber },
        mode: 'manual',
      })

      return jsonResponse(toSyncContainerResponse(result), 200, SyncContainerResponseSchema)
    } catch (err) {
      console.error(`POST /api/containers/${containerNumber}/sync error:`, err)
      return mapErrorToResponse(err)
    } finally {
      syncingContainerNumbers.delete(containerNumber)
    }
  }

  async function refreshProcessById({
    params,
    request,
  }: {
    readonly params: { readonly id?: string }
    readonly request: Request
  }): Promise<Response> {
    const processId = params.id?.trim() ?? ''
    if (processId.length === 0) {
      return jsonResponse({ error: 'Process ID is required' }, 400)
    }

    try {
      const rawBody = await request.json().catch(() => ({}))
      const parsed = ProcessRefreshRequestSchema.safeParse(rawBody)
      if (!parsed.success) {
        return jsonResponse({ error: `Invalid request: ${parsed.error.message}` }, 400)
      }

      const result = await syncUseCases.refreshProcess({
        processId,
        mode: parsed.data.mode,
        containerNumber: parsed.data.container_number,
      })

      return jsonResponse(toProcessRefreshResponse(result), 202, ProcessRefreshResponseSchema)
    } catch (err) {
      console.error(`POST /api/processes/${processId}/refresh error:`, err)
      return mapErrorToResponse(err)
    }
  }

  return {
    syncDashboard,
    syncAllProcesses,
    syncProcessById,
    syncContainerByNumber,
    refreshProcessById,
  }
}

export type SyncControllers = ReturnType<typeof createSyncControllers>
