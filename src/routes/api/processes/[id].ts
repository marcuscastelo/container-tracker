import type { APIEvent } from '@solidjs/start/server'
import type { UpdateProcessRecord } from '~/modules/process/application/process.records'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import { CreateProcessInputSchema } from '~/modules/process/interface/http/process.schemas'
import { trackingUseCases } from '~/modules/tracking/trackingUseCases'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse as typedJsonResponse } from '~/shared/api/typedRoute'
import {
  ProcessDetailResponseSchema,
  ProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

export async function PATCH({ params, request }: APIEvent): Promise<Response> {
  try {
    const processId = params.id
    if (!processId) return typedJsonResponse({ error: 'Process ID is required' }, 400)

    const rawBody = await request.json().catch(() => ({}))
    const parsed = CreateProcessInputSchema.partial().safeParse(rawBody)
    if (!parsed.success) {
      return typedJsonResponse({ error: `Invalid request: ${parsed.error.message}` }, 400)
    }

    const record: UpdateProcessRecord = {
      ...(parsed.data.reference !== undefined
        ? { reference: parsed.data.reference ?? undefined }
        : {}),
      ...(parsed.data.origin !== undefined ? { origin: parsed.data.origin?.display_name } : {}),
      ...(parsed.data.destination !== undefined
        ? { destination: parsed.data.destination?.display_name }
        : {}),
      ...(parsed.data.carrier !== undefined ? { carrier: parsed.data.carrier } : {}),
      ...(parsed.data.bill_of_lading !== undefined
        ? { bill_of_lading: parsed.data.bill_of_lading ?? undefined }
        : {}),
      ...(parsed.data.booking_number !== undefined
        ? { booking_number: parsed.data.booking_number ?? undefined }
        : {}),
      ...(parsed.data.importer_name !== undefined
        ? { importer_name: parsed.data.importer_name ?? undefined }
        : {}),
      ...(parsed.data.exporter_name !== undefined
        ? { exporter_name: parsed.data.exporter_name ?? undefined }
        : {}),
      ...(parsed.data.reference_importer !== undefined
        ? { reference_importer: parsed.data.reference_importer ?? undefined }
        : {}),
      ...(parsed.data.product !== undefined ? { product: parsed.data.product ?? null } : {}),
      ...(parsed.data.redestination_number !== undefined
        ? { redestination_number: parsed.data.redestination_number ?? null }
        : {}),
    }

    const result = await processUseCases.updateProcess({
      processId,
      record,
      containers: parsed.data.containers?.map((c) => ({
        container_number: c.container_number,
        carrier_code: c.carrier_code ?? null,
      })),
    })

    if (!result.process) return typedJsonResponse({ error: 'Process not found' }, 404)

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
        carrier_code: c.carrierCode == null ? null : String(c.carrierCode),
      })),
    }

    return typedJsonResponse(response, 200, ProcessResponseSchema)
  } catch (err) {
    console.error('PATCH /api/processes/[id] error:', err)
    return mapErrorToResponse(err)
  }
}
