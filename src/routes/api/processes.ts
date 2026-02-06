import type { z } from 'zod'
import { alertUseCases } from '~/modules/alert'
import {
  CreateProcessInputSchema,
  processUseCases,
  supabaseProcessRepository,
} from '~/modules/process'
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

    // Create initial alerts for the new process
    try {
      await alertUseCases.createProcessCreatedAlerts({
        process_id: result.process.id,
        container_ids: result.containers.map((c) => c.id),
      })
    } catch (alertErr) {
      console.warn('Failed to create initial alerts:', alertErr)
      // Don't fail the process creation if alerts fail
    }

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
    const message = err instanceof Error ? err.message : String(err)

    // Check for known error types
    if (message.includes('already exists')) {
      // Try to resolve which process owns the container so the UI can link to it
      try {
        // Expect message like: "Container MNBU3094033 already exists in the system"
        const m = message.match(/Container\s+([A-Za-z0-9]+)\s+already exists/i)
        const containerNumber = m ? m[1] : null
        if (containerNumber) {
          const container = await supabaseProcessRepository.fetchContainerByNumber(containerNumber)
          if (container) {
            const processLink = `/shipments/${container.process_id}`
            return jsonResponse(
              {
                error: message,
                existing: {
                  processId: container.process_id,
                  containerId: container.id,
                  containerNumber: container.container_number,
                  link: processLink,
                },
              },
              409,
            )
          }
        }
      } catch (resolveErr) {
        console.warn('Failed to resolve existing container owner:', resolveErr)
      }

      return jsonResponse({ error: message }, 409)
    }

    return jsonResponse({ error: message }, 500)
  }
}

export {
  ProcessResponseSchema,
  ProcessListResponseSchema,
  ErrorResponseSchema,
  CreateProcessResponseSchema,
}
