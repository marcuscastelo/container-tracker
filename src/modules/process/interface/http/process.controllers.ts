import type { ProcessUseCases } from '~/modules/process/application/process.usecases'
import {
  toContainerInputs,
  toContainerWithTrackingFallback,
  toContainerWithTrackingResponse,
  toInsertProcessRecord,
  toProcessDetailResponse,
  toProcessResponse,
  toProcessResponseWithSummary,
  toUpdateProcessRecord,
} from '~/modules/process/interface/http/process.http.mappers'
import { CreateProcessInputSchema } from '~/modules/process/interface/http/process.schemas'
import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'
import {
  ProcessDetailResponseSchema,
  ProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

export type ProcessControllerDeps = {
  readonly processUseCases: Pick<
    ProcessUseCases,
    | 'listProcessesWithOperationalSummary'
    | 'createProcess'
    | 'findProcessByIdWithContainers'
    | 'updateProcess'
    | 'findProcessById'
    | 'deleteProcess'
  >
  readonly trackingUseCases: Pick<TrackingUseCases, 'getContainerSummary' | 'getContainersSummary'>
}

function normalizeCode(value: string): string | null {
  const normalized = value.trim().toUpperCase()
  return /^[A-Z]{5,8}$/.test(normalized) ? normalized : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractPodLocationCode(destination: string | null | undefined): string | null {
  if (!destination) return null

  const directCode = normalizeCode(destination)
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
      const normalized = normalizeCode(candidate)
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
      const response = result.processes.map((p) => toProcessResponseWithSummary(p.pwc, p.summary))
      return jsonResponse(response, 200)
    } catch (err) {
      console.error('GET /api/processes error:', err)
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

      const operationalByContainerId = await trackingUseCases.getContainersSummary(
        pwc.containers.map((container) => ({
          containerId: String(container.id),
          containerNumber: String(container.containerNumber),
          podLocationCode,
        })),
        now,
      )

      // For each container, get tracking summary (observations, status, alerts)
      const trackingResults = await Promise.all(
        pwc.containers.map(async (c) => {
          try {
            const summary = await trackingUseCases.getContainerSummary(
              String(c.id),
              String(c.containerNumber),
            )
            return {
              container: toContainerWithTrackingResponse(c, summary),
              alerts: summary.alerts,
            }
          } catch (err) {
            console.error(`Failed to get tracking summary for container ${String(c.id)}:`, err)
            return {
              container: toContainerWithTrackingFallback(c),
              alerts: [],
            }
          }
        }),
      )

      const containersWithTracking = trackingResults.map((resultItem) => resultItem.container)
      const allAlerts = trackingResults.flatMap((resultItem) => resultItem.alerts)

      const response = toProcessDetailResponse(
        pwc,
        containersWithTracking,
        allAlerts,
        operationalByContainerId,
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

  return {
    listProcesses,
    createProcess,
    getProcessById,
    updateProcessById,
    deleteProcessById,
  }
}
