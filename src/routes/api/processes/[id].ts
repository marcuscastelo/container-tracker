import type { APIEvent } from '@solidjs/start/server'
import { alertUseCases } from '~/modules/alert'
import { processUseCases } from '~/modules/process'

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
