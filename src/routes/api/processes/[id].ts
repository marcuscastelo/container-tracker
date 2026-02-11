import type { APIEvent } from '@solidjs/start/server'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import {
  type CreateProcessInput,
  CreateProcessInputSchema,
} from '~/modules/process/interface/http/process.schemas'
import { trackingUseCases } from '~/modules/tracking/trackingUseCases'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse as typedJsonResponse } from '~/shared/api/typedRoute'
import {
  ProcessDetailResponseSchema,
  ProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

// GET /api/processes/[id] - Get a single process with containers, observations and alerts
export async function GET({ params }: APIEvent): Promise<Response> {
  try {
    const processId = params.id
    if (!processId) {
      return typedJsonResponse({ error: 'Process ID is required' }, 400)
    }

    const result = await processUseCases.findProcessByIdWithContainers({
      processId,
    })
    if (!result.process) {
      return typedJsonResponse({ error: 'Process not found' }, 404)
    }

    const process = result.process

    // For each container, get tracking summary (observations, status, alerts)
    const containersWithTracking = await Promise.all(
      process.containers.map(async (c) => {
        try {
          const summary = await trackingUseCases.getContainerSummary(
            String(c.id),
            String(c.containerNumber),
          )
          return {
            id: String(c.id),
            container_number: String(c.containerNumber),
            carrier_code: String(c.carrierCode),
            status: summary.status,
            observations: summary.observations.map((obs) => ({
              id: obs.id,
              fingerprint: obs.fingerprint,
              type: obs.type,
              event_time: obs.event_time,
              event_time_type: obs.event_time_type,
              location_code: obs.location_code,
              location_display: obs.location_display,
              vessel_name: obs.vessel_name,
              voyage: obs.voyage,
              is_empty: obs.is_empty,
              confidence: obs.confidence,
              provider: obs.provider,
              retroactive: obs.retroactive,
              created_at: obs.created_at,
            })),
          }
        } catch (err) {
          console.error(`Failed to get tracking summary for container ${String(c.id)}:`, err)
          return {
            id: String(c.id),
            container_number: String(c.containerNumber),
            carrier_code: String(c.carrierCode),
            status: 'UNKNOWN',
            observations: [],
          }
        }
      }),
    )

    // Gather alerts across all containers
    const allAlerts = await Promise.all(
      process.containers.map(async (c) => {
        try {
          const { alerts } = await trackingUseCases.getContainerSummary(
            String(c.id),
            String(c.containerNumber),
          )
          return alerts
        } catch {
          return []
        }
      }),
    ).then((results) => results.flat())

    const response = {
      id: process.process.id,
      reference: process.process.reference,
      origin: process.process.origin,
      destination: process.process.destination,
      carrier: process.process.carrier,
      bill_of_lading: process.process.bill_of_lading,
      booking_number: process.process.booking_number,
      importer_name: process.process.importer_name,
      exporter_name: process.process.exporter_name,
      reference_importer: process.process.reference_importer,
      product: process.process.product,
      redestination_number: process.process.redestination_number,
      source: process.process.source,
      created_at: process.process.created_at.toISOString(),
      updated_at: process.process.updated_at.toISOString(),
      containers: containersWithTracking,
      alerts: allAlerts.map((a) => ({
        id: a.id,
        category: a.category,
        type: a.type,
        severity: a.severity,
        message: a.message,
        detected_at: a.detected_at,
        triggered_at: a.triggered_at,
        retroactive: a.retroactive,
        provider: a.provider,
        acked_at: a.acked_at,
        dismissed_at: a.dismissed_at,
      })),
    }

    return typedJsonResponse(response, 200, ProcessDetailResponseSchema)
  } catch (err) {
    console.error('GET /api/processes/[id] error:', err)
    return mapErrorToResponse(err)
  }
}

// DELETE /api/processes/[id] - Delete a process and all its containers
export async function DELETE({ params }: APIEvent): Promise<Response> {
  try {
    const processId = params.id
    if (!processId) {
      return typedJsonResponse({ error: 'Process ID is required' }, 400)
    }

    // Check if process exists
    const result = await processUseCases.findProcessById({
      processId,
    })
    if (!result.process) {
      return typedJsonResponse({ error: 'Process not found' }, 404)
    }

    await processUseCases.deleteProcess({
      processId,
    })

    return typedJsonResponse({ success: true, deleted: processId })
  } catch (err) {
    console.error('DELETE /api/processes/[id] error:', err)
    return mapErrorToResponse(err)
  }
}

// PATCH /api/processes/[id] - Update process fields and containers
export async function PATCH({ params, request }: APIEvent): Promise<Response> {
  try {
    const processId = params.id
    if (!processId) {
      return typedJsonResponse({ error: 'Process ID is required' }, 400)
    }

    const rawBody = await request.json().catch(() => ({}))
    // Allow partial updates - reuse CreateProcessInputSchema but optional
    const parsed = CreateProcessInputSchema.partial().safeParse(rawBody)
    if (!parsed.success) {
      return typedJsonResponse({ error: `Invalid request: ${parsed.error.message}` }, 400)
    }

    // Map incoming containers to UI-friendly shape if present
    const input: Partial<CreateProcessInput> = {}
    if (parsed.data.reference !== undefined) input.reference = parsed.data.reference
    if (parsed.data.origin !== undefined) input.origin = parsed.data.origin
    if (parsed.data.destination !== undefined) input.destination = parsed.data.destination
    if (parsed.data.carrier !== undefined) input.carrier = parsed.data.carrier
    if (parsed.data.bill_of_lading !== undefined) input.bill_of_lading = parsed.data.bill_of_lading
    if (parsed.data.booking_number !== undefined) input.booking_number = parsed.data.booking_number
    if (parsed.data.importer_name !== undefined) input.importer_name = parsed.data.importer_name
    if (parsed.data.exporter_name !== undefined) input.exporter_name = parsed.data.exporter_name
    if (parsed.data.reference_importer !== undefined)
      input.reference_importer = parsed.data.reference_importer
    if (parsed.data.product !== undefined) input.product = parsed.data.product
    if (parsed.data.redestination_number !== undefined)
      input.redestination_number = parsed.data.redestination_number
    if (parsed.data.containers !== undefined) {
      input.containers = parsed.data.containers.map((c) => ({
        container_number: c.container_number,
        carrier_code: c.carrier_code ?? null,
      }))
    }

    const result = await processUseCases.updateProcess({
      processId,
      record: {
        reference: input.reference ?? undefined,
        origin: input.origin?.display_name,
        destination: input.destination?.display_name,
        carrier: input.carrier,
        bill_of_lading: input.bill_of_lading ?? undefined,
        booking_number: input.booking_number ?? undefined,
        importer_name: input.importer_name ?? undefined,
        exporter_name: input.exporter_name ?? undefined,
        reference_importer: input.reference_importer ?? undefined,
        product: input.product ?? undefined,
        redestination_number: input.redestination_number ?? undefined,
      },
      containers: input.containers?.map((c) => ({
        container_number: c.container_number,
        carrier_code: c.carrier_code,
      })),
    })

    if (!result.process) {
      // TODO: when 404? currently, 500 for this situation since we assume if process not found after update, it means it was deleted during the update, which is unexpected
      return typedJsonResponse({ error: 'After update, process not found' }, 500)
    }

    const updated = result.process

    const response = {
      id: updated.process.id,
      reference: updated.process.reference,
      origin: updated.process.origin,
      destination: updated.process.destination,
      carrier: updated.process.carrier,
      bill_of_lading: updated.process.bill_of_lading,
      booking_number: updated.process.booking_number,
      importer_name: updated.process.importer_name,
      exporter_name: updated.process.exporter_name,
      reference_importer: updated.process.reference_importer,
      product: updated.process.product,
      redestination_number: updated.process.redestination_number,
      source: updated.process.source,
      created_at: updated.process.created_at.toISOString(),
      updated_at: updated.process.updated_at.toISOString(),
      containers: updated.containers.map((c) => ({
        id: String(c.id),
        container_number: String(c.containerNumber),
        carrier_code: String(c.carrierCode),
      })),
    }

    return typedJsonResponse(response, 200, ProcessResponseSchema)
  } catch (err) {
    console.error('PATCH /api/processes/[id] error:', err)
    return mapErrorToResponse(err)
  }
}
