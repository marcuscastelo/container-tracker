import { z } from 'zod'
import { alertUseCases } from '~/modules/alert'
import { processUseCases, supabaseProcessRepository } from '~/modules/process'
import { CreateProcessInputSchema } from '~/modules/process/domain/processStuff'

// Response schemas
const ProcessResponseSchema = z.object({
  id: z.string(),
  reference: z.string().nullable(),
  operation_type: z.string(),
  origin: z.any().nullable(),
  destination: z.any().nullable(),
  carrier: z.string().nullable(),
  bl_reference: z.string().nullable(),
  source: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  containers: z.array(
    z.object({
      id: z.string(),
      container_number: z.string(),
      iso_type: z.string().nullable(),
      initial_status: z.string(),
    }),
  ),
})

const ProcessListResponseSchema = z.array(ProcessResponseSchema)

const ErrorResponseSchema = z.object({
  error: z.string(),
})

const CreateProcessResponseSchema = z.object({
  process: ProcessResponseSchema,
  warnings: z.array(z.string()),
})

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

    const response = processes.map((p) => ({
      id: p.id,
      reference: p.reference,
      operation_type: p.operation_type,
      origin: p.origin,
      destination: p.destination,
      carrier: p.carrier,
      bl_reference: p.bl_reference,
      source: p.source,
      created_at: p.created_at.toISOString(),
      updated_at: p.updated_at.toISOString(),
      containers: p.containers.map((c) => ({
        id: c.id,
        container_number: c.container_number,
        iso_type: c.iso_type,
        initial_status: c.initial_status,
      })),
    }))

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
        container_ids: result.process.containers.map((c) => c.id),
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
        bl_reference: result.process.bl_reference,
        source: result.process.source,
        created_at: result.process.created_at.toISOString(),
        updated_at: result.process.updated_at.toISOString(),
        containers: result.process.containers.map((c) => ({
          id: c.id,
          container_number: c.container_number,
          iso_type: c.iso_type,
          initial_status: c.initial_status,
        })),
      },
      warnings: result.warnings,
    }

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
