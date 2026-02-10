import type { z } from 'zod'
import {
  CreateProcessInputSchema,
  processUseCases,
  supabaseProcessRepository,
} from '~/modules/process'
import {
  ContainerAlreadyExistsError,
  resolveContainerOwner,
} from '~/modules/process/application/errors'
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
          operation_type: p.operation_type,
          origin: p.origin,
          destination: p.destination,
          carrier: p.carrier,
          bill_of_lading: p.bill_of_lading,
          source: p.source,
          created_at: p.created_at.toISOString(),
          updated_at: p.updated_at.toISOString(),
          containers: p.containers.map((c) => ({
            id: c.id,
            container_number: c.container_number,
            carrier_code: c.carrier_code,
            container_type: c.container_type,
            container_size: c.container_size,
          })),
        }) satisfies z.infer<typeof ProcessResponseSchema>,
    )

    return jsonResponse(response)
  } catch (err) {
    console.error('GET /api/processes error:', err)
    return jsonResponse({ error: String(err) }, 500)
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
        operation_type: result.process.operation_type,
        origin: result.process.origin,
        destination: result.process.destination,
        carrier: result.process.carrier,
        bill_of_lading: result.process.bill_of_lading,
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

    // Handle ContainerAlreadyExistsError with detailed resolution
    if (err instanceof ContainerAlreadyExistsError) {
      const owner = await resolveContainerOwner(
        err.containerNumber,
        supabaseProcessRepository.fetchContainerByNumber,
      )

      if (owner) {
        return jsonResponse(
          {
            error: err.message,
            existing: owner,
          },
          409,
        )
      }

      return jsonResponse({ error: err.message }, 409)
    }

    const message = err instanceof Error ? err.message : String(err)
    return jsonResponse({ error: message }, 500)
  }
}

export {
  ProcessResponseSchema,
  ProcessListResponseSchema,
  ErrorResponseSchema,
  CreateProcessResponseSchema,
}
