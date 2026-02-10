import type { z } from 'zod'
import {
  ContainerAlreadyExistsError,
  resolveContainerOwner,
} from '~/modules/process/application/errors'
import { CreateProcessInputSchema } from '~/modules/process/domain/processStuff'
import { supabaseProcessRepository } from '~/modules/process/infrastructure/persistence/supabaseProcessRepository'
import { processUseCases } from '~/modules/process/processUseCases'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import {
  CreateProcessResponseSchema,
  ErrorResponseSchema,
  ProcessListResponseSchema,
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
    const processes = await processUseCases.getAllProcessesWithContainers()

    const response = processes.map(
      (p) =>
        ({
          id: p.id,
          reference: p.reference,
          origin: p.origin,
          destination: p.destination,
          carrier: p.carrier,
          bill_of_lading: p.bill_of_lading,
          booking_number: p.booking_number,
          importer_name: p.importer_name,
          exporter_name: p.exporter_name,
          reference_importer: p.reference_importer,
          product: p.product,
          redestination_number: p.redestination_number,
          source: p.source,
          created_at: p.created_at.toISOString(),
          updated_at: p.updated_at.toISOString(),
          containers: p.containers.map((c) => ({
            id: c.id,
            container_number: c.container_number,
            carrier_code: c.carrier_code,
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

    const result = await processUseCases.createProcess(parsed.data)

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
          id: c.id,
          container_number: c.container_number,
          carrier_code: c.carrier_code,
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
          const r = await supabaseProcessRepository.fetchContainerByNumber(containerNumber)
          if (!r.success) return null
          return r.data
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

export {
  ProcessResponseSchema,
  ProcessListResponseSchema,
  ErrorResponseSchema,
  CreateProcessResponseSchema,
}
