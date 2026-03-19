import type { ProcessUseCases } from '~/modules/process/application/process.usecases'
import { resolveProcessDetailTracking } from '~/modules/process/interface/http/process.detail-with-tracking.http'
import {
  toContainerInputs,
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
  ProcessesV2ResponseSchema,
  ProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'
import { systemClock } from '~/shared/time/clock'

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
    | 'normalizeAutoCarriers'
  >
  readonly trackingUseCases: Pick<
    TrackingUseCases,
    'getContainerSummary' | 'getContainersSyncMetadata'
  >
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
        generated_at: systemClock.now().toIsoString(),
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
      const now = systemClock.now()
      const { containersWithTracking, allAlerts, operationalByContainerId, containersSync } =
        await resolveProcessDetailTracking(pwc, trackingUseCases, now)

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

      const result = await processUseCases.findProcessByIdWithContainers({ processId })
      if (!result.process) {
        return jsonResponse({ error: 'Process not found' }, 404)
      }

      const processReference = result.process.process.reference
      const deletedContainerCount = result.process.containers.length

      await processUseCases.deleteProcess({ processId })

      const deletedAtIso = systemClock.now().toIsoString()
      console.info(
        `[process] PROCESS_DELETED process_id=${processId} reference=${processReference ?? 'null'} container_count=${deletedContainerCount} timestamp=${deletedAtIso}`,
      )

      return new Response(null, { status: 204 })
    } catch (err) {
      console.error('DELETE /api/processes/[id] error:', err)
      return mapErrorToResponse(err)
    }
  }

  async function normalizeAutoCarriersByProcessId({
    params,
  }: {
    readonly params: { readonly id?: string }
  }): Promise<Response> {
    try {
      const processId = params.id?.trim()
      if (!processId) {
        return jsonResponse({ error: 'Process ID is required' }, 400)
      }

      const result = await processUseCases.normalizeAutoCarriers({ processId })
      if (!result) {
        return jsonResponse({ error: 'Process not found' }, 404)
      }

      return jsonResponse(result)
    } catch (err) {
      console.error('POST /api/processes/[id]/normalize-auto-carriers error:', err)
      return mapErrorToResponse(err)
    }
  }

  return {
    listProcesses,
    listProcessesV2,
    createProcess,
    getProcessById,
    updateProcessById,
    deleteProcessById,
    normalizeAutoCarriersByProcessId,
  }
}
