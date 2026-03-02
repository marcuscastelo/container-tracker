/**
 * Legacy route kept for backward compatibility.
 *
 * Queue-first migration deprecates direct Maersk scraping on the backend.
 * Use POST /api/refresh to enqueue a sync request instead.
 */

function deprecatedRefreshMaerskRoute(): Response {
  return new Response(JSON.stringify({ error: 'refresh_maersk_deprecated_use_sync_queue' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const GET = deprecatedRefreshMaerskRoute
export const POST = deprecatedRefreshMaerskRoute
