import type z4 from 'zod/v4'
import { recordReadResponseMetrics } from '~/shared/observability/readRequestMetrics'

/**
 * Helper to create a validated JSON Response.
 *
 * Validates the payload against the provided Zod schema before sending.
 * If validation fails, returns a 500 error.
 *
 * This is an HTTP-boundary utility — it uses Zod to validate response payloads
 * before serialization.
 */
export function respondWithSchema<T>(
  payload: T,
  schema: z4.ZodTypeAny,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    console.error('refresh: response validation failed', parsed.error)
    const errorBody = JSON.stringify({ error: 'response validation failed' })
    recordReadResponseMetrics(errorBody, 500)
    return new Response(errorBody, { status: 500 })
  }
  const headers = { 'Content-Type': 'application/json', ...(extraHeaders ?? {}) }
  const serialized = JSON.stringify(parsed.data)
  recordReadResponseMetrics(serialized, status)
  return new Response(serialized, { status, headers })
}
