import type { ContainerEntity } from '~/modules/container/domain/container.entity'
import { ContainerAlreadyExistsError } from '~/modules/process/application/errors'
import type { Process } from '~/modules/process/domain/process'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import { CreateProcessInputSchema } from '~/modules/process/interface/http/process.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'

function toProcessResponse(pwc: { process: Process; containers: readonly ContainerEntity[] }) {
  return {
    id: pwc.process.id,
    reference: pwc.process.reference,
    origin: pwc.process.origin,
    destination: pwc.process.destination,
    carrier: pwc.process.carrier,
    bill_of_lading: pwc.process.bill_of_lading,
    booking_number: pwc.process.booking_number,
    importer_name: pwc.process.importer_name,
    exporter_name: pwc.process.exporter_name,
    reference_importer: pwc.process.reference_importer,
    product: pwc.process.product,
    redestination_number: pwc.process.redestination_number,
    source: pwc.process.source,
    created_at: pwc.process.created_at.toISOString(),
    updated_at: pwc.process.updated_at.toISOString(),
    containers: pwc.containers.map((c) => ({
      id: String(c.id),
      container_number: String(c.containerNumber),
      carrier_code: c.carrierCode == null ? null : String(c.carrierCode),
    })),
  }
}

// GET /api/processes
export async function GET(): Promise<Response> {
  try {
    const result = await processUseCases.listProcessesWithContainers()
    const response = result.processes.map(toProcessResponse)
    return jsonResponse(response, 200)
  } catch (err) {
    console.error('GET /api/processes error:', err)
    return mapErrorToResponse(err)
  }
}

// POST /api/processes
export async function POST({ request }: { request: Request }): Promise<Response> {
  try {
    const rawBody = await request.json().catch(() => ({}))
    const parsed = CreateProcessInputSchema.safeParse(rawBody)

    if (!parsed.success) {
      return jsonResponse({ error: `Invalid request: ${parsed.error.message}` }, 400)
    }

    const result = await processUseCases.createProcess({
      record: {
        reference: parsed.data.reference ?? null,
        origin: parsed.data.origin?.display_name,
        destination: parsed.data.destination?.display_name,
        carrier: parsed.data.carrier,
        bill_of_lading: parsed.data.bill_of_lading ?? null,
        booking_number: parsed.data.booking_number ?? null,
        importer_name: parsed.data.importer_name ?? null,
        exporter_name: parsed.data.exporter_name ?? null,
        reference_importer: parsed.data.reference_importer ?? null,
        product: parsed.data.product ?? undefined,
        redestination_number: parsed.data.redestination_number ?? undefined,
        source: 'manual',
      },
      containers: parsed.data.containers.map((c) => ({
        container_number: c.container_number,
        carrier_code: c.carrier_code ?? null,
      })),
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

    if (err instanceof ContainerAlreadyExistsError) {
      return jsonResponse({ error: err.message, existing: err.existingContainer ?? null }, 409)
    }

    return mapErrorToResponse(err)
  }
}
