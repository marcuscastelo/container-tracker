import type { APIEvent } from '@solidjs/start/server'
import {
  type CreateProcessInput,
  CreateProcessInputSchema,
  processUseCases,
} from '~/modules/process'
import { jsonResponse as typedJsonResponse } from '~/shared/api/typedRoute'
import {
  ProcessDetailResponseSchema,
  ProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

// GET /api/processes/[id] - Get a single process with containers
export async function GET({ params }: APIEvent): Promise<Response> {
  try {
    const processId = params.id
    if (!processId) {
      return typedJsonResponse({ error: 'Process ID is required' }, 400)
    }

    const process = await processUseCases.getProcessWithContainers(processId)
    if (!process) {
      return typedJsonResponse({ error: 'Process not found' }, 404)
    }

    // Get alerts for this process
    // TODO: Wire up tracking_alerts when alert derivation is implemented
    const alerts: {
      id: string
      category: string
      code: string
      severity: string
      title: string
      description: string | null
      state: string
      created_at: string
    }[] = []

    const response = {
      id: process.id,
      reference: process.reference,
      operation_type: process.operation_type,
      origin: process.origin,
      destination: process.destination,
      carrier: process.carrier,
      // TODO: Rename to bill_of_lading in the future, with type safe zod schema and typescript refactor
      bl_reference: process.bill_of_lading,
      source: process.source,
      created_at: process.created_at.toISOString(),
      updated_at: process.updated_at.toISOString(),
      containers: await Promise.all(
        process.containers.map(async (c) => {
          return {
            id: c.id,
            container_number: c.container_number,
            carrier_code: c.carrier_code ?? null,
            container_type: c.container_type ?? null,
            container_size: null,
          }
        }),
      ),
      alerts: alerts.map((a) => ({
        id: a.id,
        category: a.category,
        code: a.code,
        severity: a.severity,
        title: a.title,
        description: a.description,
        state: a.state,
        created_at: a.created_at,
      })),
    }

    return typedJsonResponse(response, 200, ProcessDetailResponseSchema)
  } catch (err) {
    console.error('GET /api/processes/[id] error:', err)
    return typedJsonResponse({ error: String(err) }, 500)
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
    const process = await processUseCases.getProcess(processId)
    if (!process) {
      return typedJsonResponse({ error: 'Process not found' }, 404)
    }

    await processUseCases.deleteProcess(processId)

    return typedJsonResponse({ success: true, deleted: processId })
  } catch (err) {
    console.error('DELETE /api/processes/[id] error:', err)
    return typedJsonResponse({ error: String(err) }, 500)
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
    if (parsed.data.operation_type !== undefined) input.operation_type = parsed.data.operation_type
    if (parsed.data.origin !== undefined) input.origin = parsed.data.origin
    if (parsed.data.destination !== undefined) input.destination = parsed.data.destination
    if (parsed.data.carrier !== undefined) input.carrier = parsed.data.carrier
    if (parsed.data.bill_of_lading !== undefined) input.bill_of_lading = parsed.data.bill_of_lading
    if (parsed.data.containers !== undefined) {
      input.containers = parsed.data.containers.map((c: any) => ({
        container_number: c.container_number,
        container_type: c.container_type ?? null,
        container_size: c.container_size ?? null,
        carrier_code: c.carrier_code ?? null,
      }))
    }

    const updated = await processUseCases.updateProcess(processId, input)

    const response = {
      id: updated.id,
      reference: updated.reference,
      operation_type: updated.operation_type,
      origin: updated.origin,
      destination: updated.destination,
      carrier: updated.carrier,
      bl_reference: updated.bill_of_lading,
      source: updated.source,
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString(),
      containers: updated.containers.map((c) => ({
        id: c.id,
        container_number: c.container_number,
        carrier_code: c.carrier_code ?? null,
        container_type: c.container_type ?? null,
        container_size: c.container_size ?? null,
      })),
    }

    return typedJsonResponse(response, 200, ProcessResponseSchema)
  } catch (err) {
    console.error('PATCH /api/processes/[id] error:', err)
    return typedJsonResponse({ error: String(err) }, 500)
  }
}
