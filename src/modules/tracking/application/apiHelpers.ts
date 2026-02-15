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
