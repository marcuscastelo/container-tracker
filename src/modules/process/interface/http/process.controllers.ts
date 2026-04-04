import type { ProcessUseCases } from '~/modules/process/application/process.usecases'
import { resolveProcessDetailTracking } from '~/modules/process/interface/http/process.detail-with-tracking.http'
import {
  toContainerInputs,
  toInsertProcessRecord,
  toProcessDetailResponse,
  toProcessResponse,
  toProcessResponseWithSummary,
  toProcessSyncSnapshotResponse,
  toRecognizedAlertIncidentsResponse,
  toUpdateProcessRecord,
} from '~/modules/process/interface/http/process.http.mappers'
import {
  type CreateProcessInput,
  CreateProcessInputSchema,
} from '~/modules/process/interface/http/process.schemas'
import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'
import {
  ProcessDetailResponseSchema,
  ProcessesV2ResponseSchema,
  ProcessRecognizedAlertIncidentsResponseSchema,
  ProcessResponseSchema,
  ProcessSyncSnapshotResponseSchema,
} from '~/shared/api-schemas/processes.schemas'
import {
  readAuditedTriggerSource,
  runWithReadRequestAudit,
} from '~/shared/observability/readRequestMetrics'
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
  >
  readonly trackingUseCases: Pick<
    TrackingUseCases,
    'findContainersHotReadProjection' | 'getContainersSyncMetadata'
  > &
    Partial<Pick<TrackingUseCases, 'findContainersRecognizedAlertIncidentsProjection'>>
}

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createProcessControllers(deps: ProcessControllerDeps) {
  const { processUseCases, trackingUseCases } = deps

  async function buildProcessDetailLeanPayload(processId: string) {
    const result = await processUseCases.findProcessByIdWithContainers({ processId })
    if (!result.process) {
      return null
    }

    const pwc = result.process
    const now = systemClock.now()
    const {
      containersWithTracking,
      activeAlerts,
      activeAlertIncidents,
      operationalByContainerId,
      trackingValidationByContainerId,
      containersSync,
    } = await resolveProcessDetailTracking(pwc, trackingUseCases, now)

    return {
      pwc,
      containersWithTracking,
      activeAlerts,
      activeAlertIncidents,
      operationalByContainerId,
      containersSync,
      response: toProcessDetailResponse(
        pwc,
        containersWithTracking,
        activeAlerts,
        activeAlertIncidents,
        operationalByContainerId,
        trackingValidationByContainerId,
        containersSync,
      ),
    }
  }

  // -----------------------------------------------------------------------
  // GET /api/processes — list all processes with containers and operational summary
  // -----------------------------------------------------------------------
  async function listProcesses({ request }: { readonly request: Request }): Promise<Response> {
    return runWithReadRequestAudit(
      {
        endpoint: '/api/processes',
        projection: 'ProcessListResponse',
        readStrategy: 'tracking.hot_read_projection.process_list',
        triggeredBy: readAuditedTriggerSource(request),
      },
      async () => {
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
      },
    )
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
    request,
  }: {
    readonly params: { readonly id?: string }
    readonly request: Request
  }): Promise<Response> {
    return runWithReadRequestAudit(
      {
        endpoint: '/api/processes/:id',
        projection: 'ProcessDetailLeanResponse',
        readStrategy: 'tracking.hot_read_projection.process_detail',
        triggeredBy: readAuditedTriggerSource(request),
      },
      async () => {
        try {
          const processId = params.id
          if (!processId) {
            return jsonResponse({ error: 'Process ID is required' }, 400)
          }

          const detail = await buildProcessDetailLeanPayload(processId)
          if (!detail) {
            return jsonResponse({ error: 'Process not found' }, 404)
          }

          return jsonResponse(detail.response, 200, ProcessDetailResponseSchema)
        } catch (err) {
          console.error('GET /api/processes/[id] error:', err)
          return mapErrorToResponse(err)
        }
      },
    )
  }

  async function getProcessSyncSnapshot({
    params,
    request,
  }: {
    readonly params: { readonly id?: string }
    readonly request: Request
  }): Promise<Response> {
    return runWithReadRequestAudit(
      {
        endpoint: '/api/processes/:id/sync-state',
        projection: 'ProcessSyncSnapshotResponse',
        readStrategy: 'tracking.hot_read_projection.process_sync_snapshot',
        triggeredBy: readAuditedTriggerSource(request),
      },
      async () => {
        try {
          const processId = params.id
          if (!processId) {
            return jsonResponse({ error: 'Process ID is required' }, 400)
          }

          const detail = await buildProcessDetailLeanPayload(processId)
          if (!detail) {
            return jsonResponse({ error: 'Process not found' }, 404)
          }

          const response = toProcessSyncSnapshotResponse({
            trackingFreshnessToken: detail.response.tracking_freshness_token,
            containersSync: detail.containersSync,
          })

          return jsonResponse(response, 200, ProcessSyncSnapshotResponseSchema)
        } catch (err) {
          console.error('GET /api/processes/[id]/sync-state error:', err)
          return mapErrorToResponse(err)
        }
      },
    )
  }

  async function getProcessRecognizedAlertIncidents({
    params,
    request,
  }: {
    readonly params: { readonly id?: string }
    readonly request: Request
  }): Promise<Response> {
    return runWithReadRequestAudit(
      {
        endpoint: '/api/processes/:id/alerts/recognized',
        projection: 'ProcessRecognizedAlertIncidentsResponse',
        readStrategy: 'tracking.recognized_alerts_projection.lazy',
        triggeredBy: readAuditedTriggerSource(request),
      },
      async () => {
        try {
          const processId = params.id
          if (!processId) {
            return jsonResponse({ error: 'Process ID is required' }, 400)
          }

          const result = await processUseCases.findProcessByIdWithContainers({ processId })
          if (!result.process) {
            return jsonResponse({ error: 'Process not found' }, 404)
          }

          const recognizedAlertIncidents =
            trackingUseCases.findContainersRecognizedAlertIncidentsProjection === undefined
              ? {
                  summary: {
                    activeIncidentCount: 0,
                    affectedContainerCount: 0,
                    recognizedIncidentCount: 0,
                  },
                  active: [],
                  recognized: [],
                }
              : await trackingUseCases.findContainersRecognizedAlertIncidentsProjection({
                  containers: result.process.containers.map((container) => ({
                    containerId: String(container.id),
                    containerNumber: String(container.containerNumber),
                  })),
                })

          const response = toRecognizedAlertIncidentsResponse(recognizedAlertIncidents)

          return jsonResponse(response, 200, ProcessRecognizedAlertIncidentsResponseSchema)
        } catch (err) {
          console.error('GET /api/processes/[id]/alerts/recognized error:', err)
          return mapErrorToResponse(err)
        }
      },
    )
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

      const updateInput = {
        ...(parsed.data.reference !== undefined ? { reference: parsed.data.reference } : {}),
        ...(parsed.data.origin !== undefined ? { origin: parsed.data.origin } : {}),
        ...(parsed.data.destination !== undefined ? { destination: parsed.data.destination } : {}),
        ...(parsed.data.carrier !== undefined ? { carrier: parsed.data.carrier } : {}),
        ...(parsed.data.bill_of_lading !== undefined
          ? { bill_of_lading: parsed.data.bill_of_lading }
          : {}),
        ...(parsed.data.booking_number !== undefined
          ? { booking_number: parsed.data.booking_number }
          : {}),
        ...(parsed.data.importer_name !== undefined
          ? { importer_name: parsed.data.importer_name }
          : {}),
        ...(parsed.data.exporter_name !== undefined
          ? { exporter_name: parsed.data.exporter_name }
          : {}),
        ...(parsed.data.reference_importer !== undefined
          ? { reference_importer: parsed.data.reference_importer }
          : {}),
        ...(parsed.data.product !== undefined ? { product: parsed.data.product } : {}),
        ...(parsed.data.redestination_number !== undefined
          ? { redestination_number: parsed.data.redestination_number }
          : {}),
        ...(parsed.data.containers !== undefined ? { containers: parsed.data.containers } : {}),
      } satisfies Partial<CreateProcessInput>
      const record = toUpdateProcessRecord(updateInput)

      const result = await processUseCases.updateProcess({
        processId,
        record,
        ...(updateInput.containers === undefined
          ? {}
          : { containers: toContainerInputs({ containers: updateInput.containers }) }),
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

  return {
    listProcesses,
    listProcessesV2,
    createProcess,
    getProcessById,
    getProcessSyncSnapshot,
    getProcessRecognizedAlertIncidents,
    updateProcessById,
    deleteProcessById,
  }
}
