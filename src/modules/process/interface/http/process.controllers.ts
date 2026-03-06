import type { ProcessUseCases } from '~/modules/process/application/process.usecases'
import {
  toContainerInputs,
  toContainerWithTrackingFallback,
  toContainerWithTrackingResponse,
  toInsertProcessRecord,
  toProcessDetailResponse,
  toProcessRefreshResponse,
  toProcessResponse,
  toProcessResponseWithSummary,
  toProcessSyncStateResponse,
  toUpdateProcessRecord,
} from '~/modules/process/interface/http/process.http.mappers'
import {
  CreateProcessInputSchema,
  ProcessRefreshRequestSchema,
} from '~/modules/process/interface/http/process.schemas'
import { createTrackingOperationalSummaryFallback } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import {
  type ContainerSyncDTO,
  createContainerSyncMetadataFallback,
} from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'
import {
  ProcessDetailResponseSchema,
  ProcessesSyncStatusResponseSchema,
  ProcessesV2ResponseSchema,
  ProcessRefreshResponseSchema,
  ProcessResponseSchema,
  SyncAllProcessesResponseSchema,
  SyncProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

type ProcessControllerDeps = {
  readonly processUseCases: Pick<
    ProcessUseCases,
    | 'listProcessesWithOperationalSummary'
    | 'createProcess'
    | 'findProcessByIdWithContainers'
    | 'updateProcess'
    | 'findProcessById'
    | 'deleteProcess'
    | 'syncAllProcesses'
    | 'syncProcessContainers'
    | 'listProcessSyncStates'
    | 'refreshProcess'
  >
  readonly trackingUseCases: Pick<
    TrackingUseCases,
    'getContainerSummary' | 'getContainersSyncMetadata'
  >
}

let isSyncAllProcessesRunning = false
const syncingProcessIds = new Set<string>()

function normalizeStructuredLocationCode(value: string): string | null {
  const normalized = value.trim().toUpperCase()
  return /^[A-Z]{5}[A-Z0-9]{0,3}$/.test(normalized) ? normalized : null
}

function normalizeDirectDestinationCode(value: string): string | null {
  const normalized = value.trim().toUpperCase()
  if (/^[A-Z]{5}$/.test(normalized)) return normalized

  // Free-text destination names are common; only accept suffixes when they contain digits
  // to avoid classifying generic city names (e.g. "SANTOS") as canonical POD codes.
  if (/^[A-Z]{5}[A-Z0-9]{2,3}$/.test(normalized) && /[0-9]/.test(normalized.slice(5))) {
    return normalized
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractPodLocationCode(destination: string | null | undefined): string | null {
  if (!destination) return null

  const directCode = normalizeDirectDestinationCode(destination)
  if (directCode) return directCode

  const trimmed = destination.trim()
  if (!trimmed.startsWith('{')) return null

  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (!isRecord(parsed)) return null

    const candidates: unknown[] = [
      parsed.destination_location_code,
      parsed.pod_location_code,
      parsed.destinationCode,
      parsed.code,
      parsed.unlocode,
      parsed.location_code,
    ]

    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue
      const normalized = normalizeStructuredLocationCode(candidate)
      if (normalized) return normalized
    }

    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createProcessControllers(deps: ProcessControllerDeps) {
  const { processUseCases, trackingUseCases } = deps

  // -----------------------------------------------------------------------
  // GET /api/processes — list all processes with containers and operational summary
  // -----------------------------------------------------------------------
  async function listProcesses(): Promise<Response> {
    try {
      const result = await processUseCases.listProcessesWithOperationalSummary()
      const response = result.processes.map((p) =>
        toProcessResponseWithSummary(p.pwc, p.summary, p.sync),
      )
      return jsonResponse(response, 200)
    } catch (err) {
      console.error('GET /api/processes error:', err)
      return mapErrorToResponse(err)
    }
  }

  // -----------------------------------------------------------------------
  // GET /api/processes-v2 — list all processes in an envelope with generated timestamp
  // -----------------------------------------------------------------------
  async function listProcessesV2(): Promise<Response> {
    try {
      const result = await processUseCases.listProcessesWithOperationalSummary()
      const response = {
        generated_at: new Date().toISOString(),
        processes: result.processes.map((p) =>
          toProcessResponseWithSummary(p.pwc, p.summary, p.sync),
        ),
      }
      return jsonResponse(response, 200, ProcessesV2ResponseSchema)
    } catch (err) {
      console.error('GET /api/processes-v2 error:', err)
      return mapErrorToResponse(err)
    }
  }

  // -----------------------------------------------------------------------
  // GET /api/processes/sync-status — process sync observability read model
  // -----------------------------------------------------------------------
  async function listProcessesSyncStatus(): Promise<Response> {
    try {
      const result = await processUseCases.listProcessSyncStates()
      const response = {
        generated_at: result.generatedAt,
        processes: result.processes.map(toProcessSyncStateResponse),
      }
      const validated = ProcessesSyncStatusResponseSchema.parse(response)
      return new Response(JSON.stringify(validated), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      })
    } catch (err) {
      console.error('GET /api/processes/sync-status error:', err)
      return mapErrorToResponse(err)
    }
  }

  // -----------------------------------------------------------------------
  // POST /api/processes — create a new process
  // -----------------------------------------------------------------------
  async function createProcess({ request }: { request: Request }): Promise<Response> {
    try {
      const rawBody = await request.json().catch(() => ({}))
      const parsed = CreateProcessInputSchema.safeParse(rawBody)

      if (!parsed.success) {
        return jsonResponse({ error: `Invalid request: ${parsed.error.message}` }, 400)
      }

      const result = await processUseCases.createProcess({
        record: toInsertProcessRecord(parsed.data),
        containers: toContainerInputs(parsed.data),
      })

      return jsonResponse(
        {
          process: toProcessResponse({
            process: result.process,
            containers: result.containers,
          }),
          warnings: result.warnings,
        },
        201,
      )
    } catch (err) {
      console.error('POST /api/processes error:', err)
      return mapErrorToResponse(err)
    }
  }

  // -----------------------------------------------------------------------
  // GET /api/processes/[id] — get a single process with tracking detail
  // -----------------------------------------------------------------------
  async function getProcessById({
    params,
  }: {
    readonly params: { readonly id?: string }
  }): Promise<Response> {
    try {
      const processId = params.id
      if (!processId) {
        return jsonResponse({ error: 'Process ID is required' }, 400)
      }

      const result = await processUseCases.findProcessByIdWithContainers({ processId })
      if (!result.process) {
        return jsonResponse({ error: 'Process not found' }, 404)
      }

      const pwc = result.process
      const now = new Date()
      // Destination can be a canonical code or a serialized location payload.
      // If we cannot extract a canonical POD code, tracking falls back safely.
      const podLocationCode = extractPodLocationCode(pwc.process.destination)
      const containerNumbers = pwc.containers.map((container) =>
        String(container.containerNumber).trim().toUpperCase(),
      )
      let containersSync: readonly ContainerSyncDTO[] = containerNumbers.map((containerNumber) =>
        createContainerSyncMetadataFallback(containerNumber),
      )

      try {
        containersSync = await trackingUseCases.getContainersSyncMetadata({
          containerNumbers,
        })
      } catch (err) {
        console.error('Failed to get container sync metadata:', err)
      }

      // For each container, get tracking summary (observations, status, alerts)
      const trackingResults = await Promise.all(
        pwc.containers.map(async (c) => {
          try {
            const summary = await trackingUseCases.getContainerSummary(
              String(c.id),
              String(c.containerNumber),
              podLocationCode,
              now,
              { includeAcknowledgedAlerts: true },
            )
            return {
              container: toContainerWithTrackingResponse(c, summary),
              alerts: summary.alerts,
              operational: summary.operational,
            }
          } catch (err) {
            console.error(`Failed to get tracking summary for container ${String(c.id)}:`, err)
            return {
              container: toContainerWithTrackingFallback(c),
              alerts: [],
              operational: createTrackingOperationalSummaryFallback(true),
            }
          }
        }),
      )

      const operationalByContainerId = new Map<
        string,
        (typeof trackingResults)[number]['operational']
      >()
      for (const resultItem of trackingResults) {
        operationalByContainerId.set(resultItem.container.id, resultItem.operational)
      }

      const containersWithTracking = trackingResults.map((resultItem) => resultItem.container)
      const allAlerts = trackingResults.flatMap((resultItem) => resultItem.alerts)

      const response = toProcessDetailResponse(
        pwc,
        containersWithTracking,
        allAlerts,
        operationalByContainerId,
        containersSync,
      )

      return jsonResponse(response, 200, ProcessDetailResponseSchema)
    } catch (err) {
      console.error('GET /api/processes/[id] error:', err)
      return mapErrorToResponse(err)
    }
  }

  // -----------------------------------------------------------------------
  // PATCH /api/processes/[id] — update process fields and containers
  // -----------------------------------------------------------------------
  async function updateProcessById({
    params,
    request,
  }: {
    readonly params: { readonly id?: string }
    readonly request: Request
  }): Promise<Response> {
    try {
      const processId = params.id
      if (!processId) {
        return jsonResponse({ error: 'Process ID is required' }, 400)
      }

      const rawBody = await request.json().catch(() => ({}))
      const parsed = CreateProcessInputSchema.partial().safeParse(rawBody)
      if (!parsed.success) {
        return jsonResponse({ error: `Invalid request: ${parsed.error.message}` }, 400)
      }

      const record = toUpdateProcessRecord(parsed.data)

      const result = await processUseCases.updateProcess({
        processId,
        record,
        containers: parsed.data.containers
          ? toContainerInputs({ containers: parsed.data.containers })
          : undefined,
      })

      if (!result.process) {
        return jsonResponse({ error: 'Process not found' }, 404)
      }

      const response = toProcessResponse(result.process)

      return jsonResponse(response, 200, ProcessResponseSchema)
    } catch (err) {
      console.error('PATCH /api/processes/[id] error:', err)
      return mapErrorToResponse(err)
    }
  }

  // -----------------------------------------------------------------------
  // DELETE /api/processes/[id] — delete a process and all its containers
  // -----------------------------------------------------------------------
  async function deleteProcessById({
    params,
  }: {
    readonly params: { readonly id?: string }
  }): Promise<Response> {
    try {
      const processId = params.id
      if (!processId) {
        return jsonResponse({ error: 'Process ID is required' }, 400)
      }

      const result = await processUseCases.findProcessById({ processId })
      if (!result.process) {
        return jsonResponse({ error: 'Process not found' }, 404)
      }

      await processUseCases.deleteProcess({ processId })

      return jsonResponse({ success: true, deleted: processId })
    } catch (err) {
      console.error('DELETE /api/processes/[id] error:', err)
      return mapErrorToResponse(err)
    }
  }

  // -----------------------------------------------------------------------
  // POST /api/processes/sync — run global tracking sync for active processes
  // -----------------------------------------------------------------------
  async function syncAllProcesses(): Promise<Response> {
    if (isSyncAllProcessesRunning || syncingProcessIds.size > 0) {
      return jsonResponse({ error: 'sync_already_running' }, 409)
    }

    isSyncAllProcessesRunning = true
    try {
      const result = await processUseCases.syncAllProcesses()
      return jsonResponse(
        {
          ok: true,
          syncedProcesses: result.syncedProcesses,
          syncedContainers: result.syncedContainers,
        },
        200,
        SyncAllProcessesResponseSchema,
      )
    } catch (err) {
      console.error('POST /api/processes/sync error:', err)
      return mapErrorToResponse(err)
    } finally {
      isSyncAllProcessesRunning = false
    }
  }

  // -----------------------------------------------------------------------
  // POST /api/processes/[id]/sync — run tracking sync for a single process
  // -----------------------------------------------------------------------
  async function syncProcessById({
    params,
  }: {
    readonly params: { readonly id?: string }
  }): Promise<Response> {
    const processId = params.id?.trim() ?? ''
    if (processId.length === 0) {
      return jsonResponse({ error: 'Process ID is required' }, 400)
    }

    if (isSyncAllProcessesRunning || syncingProcessIds.has(processId)) {
      return jsonResponse({ error: 'sync_already_running' }, 409)
    }

    syncingProcessIds.add(processId)
    try {
      const result = await processUseCases.syncProcessContainers({
        processId,
      })
      return jsonResponse(
        {
          ok: true,
          processId: result.processId,
          syncedContainers: result.syncedContainers,
        },
        200,
        SyncProcessResponseSchema,
      )
    } catch (err) {
      console.error(`POST /api/processes/${processId}/sync error:`, err)
      return mapErrorToResponse(err)
    } finally {
      syncingProcessIds.delete(processId)
    }
  }

  // -----------------------------------------------------------------------
  // POST /api/processes/[id]/refresh — enqueue async refresh for process/container mode
  // -----------------------------------------------------------------------
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

      const result = await processUseCases.refreshProcess({
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
    listProcesses,
    listProcessesV2,
    listProcessesSyncStatus,
    createProcess,
    getProcessById,
    updateProcessById,
    deleteProcessById,
    syncAllProcesses,
    syncProcessById,
    refreshProcessById,
  }
}
