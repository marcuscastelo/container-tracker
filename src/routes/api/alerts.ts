/**
 * Alerts API route — powered by the tracking module.
 *
 * GET /api/alerts?container_id=<uuid> — List active alerts for a container
 * PATCH /api/alerts — Acknowledge or dismiss an alert
 */

import { z } from 'zod'
import { trackingUseCases } from '~/modules/tracking/trackingUseCases'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'

// Helper to create JSON response
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// GET /api/alerts?container_id=<uuid> - List active alerts for a container
export async function GET({ request }: { request: Request }): Promise<Response> {
  try {
    const url = new URL(request.url)
    const containerId = url.searchParams.get('container_id')
    if (!containerId) {
      return jsonResponse({ error: 'container_id query parameter is required' }, 400)
    }

    // getContainerSummary needs containerNumber, but for alerts we only need containerId.
    // We use the tracking alert repository directly via the use case.
    // For simplicity, return the alerts portion of getContainerSummary with a placeholder containerNumber.
    const summary = await trackingUseCases.getContainerSummary(containerId, '')
    return jsonResponse(
      summary.alerts.map((a) => ({
        id: a.id,
        category: a.category,
        type: a.type,
        severity: a.severity,
        message: a.message,
        detected_at: a.detected_at,
        triggered_at: a.triggered_at,
        retroactive: a.retroactive,
        provider: a.provider,
        acked_at: a.acked_at,
        dismissed_at: a.dismissed_at,
      })),
    )
  } catch (err) {
    console.error('GET /api/alerts error:', err)
    return mapErrorToResponse(err)
  }
}

const AlertActionSchema = z.object({
  alert_id: z.string(),
  action: z.enum(['acknowledge', 'dismiss']),
})

// PATCH /api/alerts - Acknowledge or dismiss an alert
export async function PATCH({ request }: { request: Request }): Promise<Response> {
  try {
    const raw = await request.json().catch(() => ({}))
    const parsed = AlertActionSchema.safeParse(raw)
    if (!parsed.success) {
      return jsonResponse({ error: `Invalid request: ${parsed.error.message}` }, 400)
    }

    const { alert_id, action } = parsed.data

    if (action === 'acknowledge') {
      await trackingUseCases.acknowledgeAlert(alert_id)
    } else {
      await trackingUseCases.dismissAlert(alert_id)
    }

    return jsonResponse({ ok: true, alert_id, action })
  } catch (err) {
    console.error('PATCH /api/alerts error:', err)
    return mapErrorToResponse(err)
  }
}
