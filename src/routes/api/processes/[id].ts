import type { APIEvent } from '@solidjs/start/server'
import { alertUseCases } from '~/modules/alert'
import { processUseCases } from '~/modules/process'
import { CreateProcessInputSchema } from '~/modules/process/domain/process'

// Helper to create JSON response
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// GET /api/processes/[id] - Get a single process with containers
export async function GET({ params }: APIEvent): Promise<Response> {
  try {
    const processId = params.id
    if (!processId) {
      return jsonResponse({ error: 'Process ID is required' }, 400)
    }

    const process = await processUseCases.getProcessWithContainers(processId)
    if (!process) {
      return jsonResponse({ error: 'Process not found' }, 404)
    }

    // Get alerts for this process
    const alerts = await alertUseCases.getAlertsForProcess(processId)

    const response = {
      id: process.id,
      reference: process.reference,
      operation_type: process.operation_type,
      origin: process.origin,
      destination: process.destination,
      carrier: process.carrier,
      bl_reference: process.bl_reference,
      source: process.source,
      created_at: process.created_at.toISOString(),
      updated_at: process.updated_at.toISOString(),
      containers: process.containers.map((c) => ({
        id: c.id,
        container_number: c.container_number,
        iso_type: c.iso_type,
        initial_status: c.initial_status,
      })),
      alerts: alerts.map((a) => ({
        id: a.id,
        category: a.category,
        code: a.code,
        severity: a.severity,
        title: a.title,
        description: a.description,
        state: a.state,
        created_at: a.created_at.toISOString(),
      })),
    }

    return jsonResponse(response)
  } catch (err) {
    console.error('GET /api/processes/[id] error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
}

// DELETE /api/processes/[id] - Delete a process and all its containers
export async function DELETE({ params }: APIEvent): Promise<Response> {
  try {
    const processId = params.id
    if (!processId) {
      return jsonResponse({ error: 'Process ID is required' }, 400)
    }

    // Check if process exists
    const process = await processUseCases.getProcess(processId)
    if (!process) {
      return jsonResponse({ error: 'Process not found' }, 404)
    }

    await processUseCases.deleteProcess(processId)

    return jsonResponse({ success: true, deleted: processId })
  } catch (err) {
    console.error('DELETE /api/processes/[id] error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
}

// PATCH /api/processes/[id] - Update process fields and containers
export async function PATCH({ params, request }: APIEvent): Promise<Response> {
  try {
    const processId = params.id
    if (!processId) {
      return jsonResponse({ error: 'Process ID is required' }, 400)
    }

    const rawBody = await request.json().catch(() => ({}))
    // Allow partial updates - reuse CreateProcessInputSchema but optional
    const parsed = CreateProcessInputSchema.partial().safeParse(rawBody)
    if (!parsed.success) {
      return jsonResponse({ error: `Invalid request: ${parsed.error.message}` }, 400)
    }

    // Map incoming containers to UI-friendly shape if present
    const input: any = {}
    if (parsed.data.reference !== undefined) input.reference = parsed.data.reference
    if (parsed.data.operation_type !== undefined) input.operationType = parsed.data.operation_type
    if (parsed.data.origin !== undefined) input.origin = parsed.data.origin
    if (parsed.data.destination !== undefined) input.destination = parsed.data.destination
    if (parsed.data.carrier !== undefined) input.carrier = parsed.data.carrier
    if (parsed.data.bl_reference !== undefined) input.blReference = parsed.data.bl_reference
    if (parsed.data.containers !== undefined) {
      input.containers = parsed.data.containers.map((c: any) => ({
        containerNumber: c.container_number,
        isoType: c.iso_type ?? null,
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
      bl_reference: updated.bl_reference,
      source: updated.source,
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString(),
      containers: updated.containers.map((c) => ({
        id: c.id,
        container_number: c.container_number,
        iso_type: c.iso_type,
        initial_status: c.initial_status,
      })),
    }

    return jsonResponse(response)
  } catch (err) {
    console.error('PATCH /api/processes/[id] error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
}
