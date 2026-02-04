import { z } from 'zod'
import { alertUseCases } from '~/modules/alert'

// Helper to create JSON response
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// GET /api/alerts - List all active alerts
export async function GET(): Promise<Response> {
  try {
    const alerts = await alertUseCases.getActiveAlerts()

    const response = alerts.map((a) => ({
      id: a.id,
      process_id: a.process_id,
      container_id: a.container_id,
      category: a.category,
      code: a.code,
      severity: a.severity,
      title: a.title,
      description: a.description,
      state: a.state,
      created_at: a.created_at.toISOString(),
    }))

    return jsonResponse(response)
  } catch (err) {
    console.error('GET /api/alerts error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
}

// PATCH request schema for acknowledging/resolving alerts
const PatchAlertSchema = z.object({
  action: z.enum(['acknowledge', 'resolve']),
  alert_id: z.string(),
})

// PATCH /api/alerts - Acknowledge or resolve an alert
export async function PATCH({ request }: { request: Request }): Promise<Response> {
  try {
    const rawBody = await request.json().catch(() => ({}))
    const parsed = PatchAlertSchema.safeParse(rawBody)

    if (!parsed.success) {
      return jsonResponse({ error: `Invalid request: ${parsed.error.message}` }, 400)
    }

    const { action, alert_id } = parsed.data

    let alert
    if (action === 'acknowledge') {
      alert = await alertUseCases.acknowledgeAlert(alert_id)
    } else {
      alert = await alertUseCases.resolveAlert(alert_id)
    }

    return jsonResponse({
      id: alert.id,
      state: alert.state,
      acknowledged_at: alert.acknowledged_at?.toISOString() ?? null,
      resolved_at: alert.resolved_at?.toISOString() ?? null,
    })
  } catch (err) {
    console.error('PATCH /api/alerts error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
}

// POST /api/alerts/cleanup - Cleanup expired alerts (for cron jobs)
export async function POST(): Promise<Response> {
  try {
    const deletedCount = await alertUseCases.cleanupExpiredAlerts()
    return jsonResponse({ deleted: deletedCount })
  } catch (err) {
    console.error('POST /api/alerts/cleanup error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
}
