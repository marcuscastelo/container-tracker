/**
 * Alerts API route — placeholder.
 *
 * The old alert module has been removed. The new tracking_alerts system
 * (in src/modules/tracking/) will power this endpoint once observations
 * and alert derivation are wired up.
 *
 * For now, these endpoints return empty/no-op responses so the frontend
 * doesn't break.
 */

// Helper to create JSON response
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// GET /api/alerts - List all active alerts (empty for now)
export async function GET(): Promise<Response> {
  return jsonResponse([])
}

// PATCH /api/alerts - Acknowledge or resolve an alert (no-op for now)
export async function PATCH(): Promise<Response> {
  return jsonResponse({ error: 'Alert management not yet implemented in new tracking module' }, 501)
}

// POST /api/alerts/cleanup - Cleanup expired alerts (no-op for now)
export async function POST(): Promise<Response> {
  return jsonResponse({ deleted: 0 })
}
