import { containerStatusUseCases } from '~/modules/container'
import { z } from 'zod'
import { getProvider } from './refresh-providers'

// Explicit request/response schemas for this API
const RefreshRequestSchema = z.object({
  container: z.string(),
  carrier: z.string().optional().nullable(),
}).strict()

const RefreshSuccessResponseSchema = z.object({ ok: z.literal(true), container: z.string() })
const RefreshRedirectResponseSchema = z.object({ redirect: z.string() })
const RefreshResponseSchema = z.union([RefreshSuccessResponseSchema, RefreshRedirectResponseSchema])
const RefreshErrorResponseSchema = z.object({ error: z.string() })

export {
  RefreshResponseSchema,
  RefreshSuccessResponseSchema,
  RefreshRedirectResponseSchema,
  RefreshErrorResponseSchema,
}

export type RefreshRequest = z.infer<typeof RefreshRequestSchema>
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>
export type RefreshErrorResponse = z.infer<typeof RefreshErrorResponseSchema>

// Health response schema for GET
export const RefreshHealthResponseSchema = z.object({ ok: z.literal(true) })
export type RefreshHealthResponse = z.infer<typeof RefreshHealthResponseSchema>

// Helper to validate payloads against schemas and return Response
function respondWithSchema<T>(payload: T, schema: z.ZodTypeAny, status = 200, extraHeaders?: Record<string,string>) {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    console.error('refresh: response validation failed', parsed.error.format())
    return new Response(JSON.stringify({ error: 'response validation failed' }), { status: 500 })
  }
  const headers = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {})
  return new Response(JSON.stringify(parsed.data), { status, headers })
}

export async function POST({ request }: any) {
  try {
    const rawBody = await request.json().catch(() => ({}))
    const parsedReq = RefreshRequestSchema.safeParse(rawBody)
    if (!parsedReq.success) return respondWithSchema({ error: `invalid request: ${parsedReq.error.message}` }, RefreshErrorResponseSchema, 400)
    const container = parsedReq.data.container
    const provider = parsedReq.data.carrier || 'unknown'
    // Fetch container record from DB
    const rec = await containerStatusUseCases.getContainerStatus(String(container))
    if (!rec) return new Response(JSON.stringify({ error: 'container not found in DB', container }), { status: 404 })

    // If provider is Maersk we keep the existing redirect to the puppeteer handler
    if (provider === 'maersk') {
      const redirectPath = `/api/refresh-maersk/${encodeURIComponent(String(container))}`
      const redirectPayload = { redirect: redirectPath }
      if (RefreshRedirectResponseSchema.safeParse(redirectPayload).success) {
        return new Response(JSON.stringify(redirectPayload), { status: 307, headers: { Location: redirectPath, 'Content-Type': 'application/json' } })
      }
      return respondWithSchema(redirectPayload, RefreshRedirectResponseSchema, 307, { Location: redirectPath })
    }
    // Lookup provider handler and invoke it to get a parsed status object.
    const handler = getProvider(String(provider))
    if (!handler) {
      console.error(`refresh: no handler for carrier '${provider}'`)
      return respondWithSchema({ error: `no handler for carrier ${provider}` }, RefreshErrorResponseSchema, 400)
    }

    let result: { parsedStatus?: Record<string, unknown>; raw?: string } | undefined
    try {
      console.debug(`refresh: invoking handler for provider='${provider}' container='${container}'`)
      result = await handler.fetchStatus(String(container))
    } catch (err) {
      console.error('refresh: provider fetch failed', err)
      return respondWithSchema({ error: `provider fetch failed: ${String(err)}` }, RefreshErrorResponseSchema, 502)
    }

    let parsedStatus: Record<string, unknown> = {}
    if (!result) {
      parsedStatus = { raw: '' }
    } else if (result.parsedStatus) {
      parsedStatus = result.parsedStatus
    } else if (typeof result.raw === 'string') {
      parsedStatus = { raw: result.raw }
    } else {
      parsedStatus = { raw: '' }
    }

    // Sanitize strings to avoid Postgres errors when inserting JSON/text
    // (e.g. unsupported Unicode escape sequences such as \u0000 or actual NUL bytes).
    function sanitizeValue(v: unknown): unknown {
      if (typeof v === 'string') {
        // Remove literal backslash-u0000 sequences and actual NUL characters
        return v.replace(/\\u0000/g, '').replace(/\u0000/g, '')
      }
      if (Array.isArray(v)) return v.map(sanitizeValue)
      if (v && typeof v === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
          out[k] = sanitizeValue(val)
        }
        return out
      }
      return v
    }

    parsedStatus = sanitizeValue(parsedStatus) as Record<string, unknown>

    try {
      console.log(`refresh: saving container ${container} status to Supabase, status=${JSON.stringify(parsedStatus, null, 2).substring(0, 100)}`)
      await containerStatusUseCases.saveContainerStatus(String(container), parsedStatus)
      console.log(`refresh: saved container ${container} to Supabase`)
    } catch (err) {
      console.error('refresh: Supabase save failed', err)
      return respondWithSchema({ error: `Supabase save failed: ${String(err)}` }, RefreshErrorResponseSchema, 500)
    }

    return respondWithSchema({ ok: true, container: String(container) }, RefreshSuccessResponseSchema, 200)
  } catch (err: any) {
    console.error('refresh error', err)
    return respondWithSchema({ error: String(err) }, RefreshErrorResponseSchema, 500)
  }
}

export const GET = () => respondWithSchema({ ok: true }, RefreshHealthResponseSchema, 200)
