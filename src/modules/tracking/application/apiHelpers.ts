import type z4 from 'zod/v4'

/**
 * Helper to create a validated JSON Response.
 *
 * Validates the payload against the provided Zod schema before sending.
 * If validation fails, returns a 500 error.
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
    return new Response(JSON.stringify({ error: 'response validation failed' }), { status: 500 })
  }
  const headers = { 'Content-Type': 'application/json', ...(extraHeaders ?? {}) }
  return new Response(JSON.stringify(parsed.data), { status, headers })
}

/**
 * Remove NUL characters and backslash-u0000 sequences from values.
 * Some carrier APIs return invalid JSON with embedded NUL bytes.
 *
 * This function works on `unknown` input to avoid type assertions.
 */
export function sanitizePayload(v: unknown): unknown {
  if (typeof v === 'string') {
    return v.replace(/\\u0000/g, '').replace(/\u0000/g, '')
  }
  if (Array.isArray(v)) return v.map(sanitizePayload)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) {
      out[k] = sanitizePayload(val)
    }
    return out
  }
  return v
}
