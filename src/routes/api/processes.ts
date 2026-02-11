import type { z } from 'zod'
import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import {
  ContainerAlreadyExistsError,
  resolveContainerOwner,
} from '~/modules/process/application/errors'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import { CreateProcessInputSchema } from '~/modules/process/interface/http/process.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import type {
  CreateProcessResponseSchema,
  ProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

// Helper to create JSON response
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// GET /api/processes - List all processes with containers
export async function GET(): Promise<Response> {
  try {
    const result = await processUseCases.listProcessesWithContainers()

    if (!result.processes) {
      return jsonResponse({ error: 'Failed to fetch processes' }, 500)
    }

    const processes = result.processes

    const response = processes.map(
      (pwc) =>
        ({
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
            carrier_code: String(c.carrierCode),
          })),
        }) satisfies z.infer<typeof ProcessResponseSchema>,
    )

    return jsonResponse(response)
  } catch (err) {
    console.error('GET /api/processes error:', err)
    return mapErrorToResponse(err)
  }
}

// POST /api/processes - Create a new process with containers
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

    const response = {
      process: {
        id: result.process.id,
        reference: result.process.reference,
        origin: result.process.origin,
        destination: result.process.destination,
        carrier: result.process.carrier,
        bill_of_lading: result.process.bill_of_lading,
        booking_number: result.process.booking_number,
        importer_name: result.process.importer_name,
        exporter_name: result.process.exporter_name,
        reference_importer: result.process.reference_importer,
        product: result.process.product,
        redestination_number: result.process.redestination_number,
        source: result.process.source,
        created_at: result.process.created_at.toISOString(),
        updated_at: result.process.updated_at.toISOString(),
        containers: result.containers.map((c) => ({
          id: String(c.id),
          container_number: String(c.containerNumber),
          carrier_code: String(c.carrierCode),
        })),
      },
      warnings: result.warnings,
    } satisfies z.infer<typeof CreateProcessResponseSchema>

    return jsonResponse(response, 201)
  } catch (err) {
    console.error('POST /api/processes error:', err)

    // TODO: change direct repository calls to an application service / use case / etc method that encapsulates the logic of looking up container ownership, which might include additional checks or logic in the future. For now, we can reuse the existing repository method.
    // Issue URL: https://github.com/marcuscastelo/container-tracker/issues/33
    // Handle ContainerAlreadyExistsError with detailed resolution (keep special behavior)
    if (err instanceof ContainerAlreadyExistsError) {
      const owner = await resolveContainerOwner(
        err.containerNumber,
        async (containerNumber: string) => {
          return await containerUseCases
            .findByNumbers({ containerNumbers: [containerNumber] })
            .then((result) => result.containers[0] ?? null)
        },
      )

      if (owner) {
        return jsonResponse({ error: err.message, existing: owner }, 409)
      }

      return jsonResponse({ error: err.message }, 409)
    }

    return mapErrorToResponse(err)
  }
}
