import { z } from 'zod'
import { mapParsedStatusToF1 } from '~/adapters/toCanonical.adapter'
import { alertUseCases } from '~/modules/alert'
import { containerStatusUseCases } from '~/modules/container'
import { type CreateProcessInput, processUseCases } from '~/modules/process'
import { getProvider } from '~/routes/api/refresh-providers'

// Explicit request/response schemas for this API
const RefreshRequestSchema = z
  .object({
    container: z.string(),
    carrier: z.string().optional().nullable(),
  })
  .strict()

const RefreshSuccessResponseSchema = z.object({
  ok: z.literal(true),
  container: z.string(),
})
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
function respondWithSchema<T>(
  payload: T,
  schema: z.ZodTypeAny,
  status = 200,
  extraHeaders?: Record<string, string>,
) {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    console.error('refresh: response validation failed', parsed.error.format())
    return new Response(JSON.stringify({ error: 'response validation failed' }), { status: 500 })
  }
  const headers = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {})
  return new Response(JSON.stringify(parsed.data), { status, headers })
}

export async function POST({ request }: { request: Request }) {
  try {
    const rawBody = await request.json().catch(() => ({}))
    const parsedReq = RefreshRequestSchema.safeParse(rawBody)
    if (!parsedReq.success)
      return respondWithSchema(
        { error: `invalid request: ${parsedReq.error.message}` },
        RefreshErrorResponseSchema,
        400,
      )
    const container = parsedReq.data.container
    const provider = parsedReq.data.carrier || 'unknown'

    // If provider is Maersk we keep the existing redirect to the puppeteer handler
    if (provider === 'maersk') {
      const redirectPath = `/api/refresh-maersk/${encodeURIComponent(String(container))}`
      const redirectPayload = { redirect: redirectPath }
      if (RefreshRedirectResponseSchema.safeParse(redirectPayload).success) {
        return new Response(JSON.stringify(redirectPayload), {
          status: 307,
          headers: {
            Location: redirectPath,
            'Content-Type': 'application/json',
          },
        })
      }
      return respondWithSchema(redirectPayload, RefreshRedirectResponseSchema, 307, {
        Location: redirectPath,
      })
    }
    // Lookup provider handler and invoke it to get a parsed status object.
    const handler = getProvider(String(provider))
    if (!handler) {
      console.error(`refresh: no handler for carrier '${provider}'`)
      return respondWithSchema(
        { error: `no handler for carrier ${provider}` },
        RefreshErrorResponseSchema,
        400,
      )
    }

    let result: { parsedStatus?: Record<string, unknown>; raw?: string } | undefined
    try {
      console.debug(`refresh: invoking handler for provider='${provider}' container='${container}'`)
      result = await handler.fetchStatus(String(container))
    } catch (err) {
      console.error('refresh: provider fetch failed', err)
      return respondWithSchema(
        { error: `provider fetch failed: ${String(err)}` },
        RefreshErrorResponseSchema,
        502,
      )
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
      // Map parsedStatus to canonical F1 shape before saving
      const mapped = mapParsedStatusToF1(parsedStatus, String(container), provider)
      if (!mapped.ok) {
        console.error('refresh: mapping to canonical failed', mapped.error)
        return respondWithSchema(
          { error: `mapping to canonical failed: ${mapped.error}` },
          RefreshErrorResponseSchema,
          500,
        )
      }

      const canonicalStatus = mapped.shipment
      console.log(
        `refresh: saving canonical status for container ${container} to Supabase, shipment id=${canonicalStatus.id}`,
      )
      // Save canonical object as the status payload
      await containerStatusUseCases.saveContainerStatus(
        String(container),
        canonicalStatus as Record<string, unknown>,
      )
      console.log(`refresh: saved canonical container ${container} to Supabase`)
      // Ingest canonical shipment into Processes so the UI (Dashboard) can surface it.
      // This follows the event->state->UI flow by creating/updating a Process derived
      // from the canonical F1 shipment. Failures here must NOT break the refresh API.
      try {
        const shipment = canonicalStatus as Record<string, unknown>
        const containers = Array.isArray(shipment.containers) ? shipment.containers : []

        if (containers.length > 0) {
          const createInput: CreateProcessInput = {
            reference: null,
            operation_type: 'import',
            origin: shipment.origin
              ? { display_name: (shipment.origin as any).city ?? null }
              : null,
            destination: shipment.destination
              ? { display_name: (shipment.destination as any).city ?? null }
              : null,
            carrier: (shipment.carrier as any) ?? null,
            bl_reference: null,
            containers: containers.map((c: any) => ({
              container_number: String(c.container_number ?? c.container_no ?? '').toUpperCase(),
              iso_type: c.iso_code ?? c.iso_type ?? null,
            })),
          }

          try {
            const res = await processUseCases.createProcess(createInput)
            console.log(`refresh: created process ${res.process.id} for container ${container}`)
            try {
              // create initial alerts similarly to API process creation
              await alertUseCases.createProcessCreatedAlerts({
                process_id: res.process.id,
                container_ids: res.process.containers.map((c) => c.id),
              })
            } catch (ae) {
              console.warn('refresh: failed to create initial alerts for imported process', ae)
            }
          } catch (createErr: any) {
            // If creation failed because container already exists, try to reconcile by
            // finding the existing process and updating it (non-blocking).
            const msg = String(createErr?.message ?? createErr)
            console.warn('refresh: createProcess failed, attempting reconciliation:', msg)
            try {
              const all = await processUseCases.getAllProcessesWithContainers()
              const normalized = String(container).toUpperCase().trim()
              const found = all.find((p) =>
                p.containers.some((c) => c.container_number === normalized),
              )
              if (found) {
                // Attempt to update missing metadata (carrier/origin/destination) if empty
                const updates: Record<string, unknown> = {}
                if (!found.carrier && createInput.carrier) updates.carrier = createInput.carrier
                if ((!found.origin || !found.origin.display_name) && createInput.origin)
                  updates.origin = createInput.origin
                if (
                  (!found.destination || !found.destination.display_name) &&
                  createInput.destination
                )
                  updates.destination = createInput.destination
                if (Object.keys(updates).length > 0) {
                  await processUseCases.updateProcess(found.id, updates)
                  console.log(`refresh: reconciled process ${found.id} for container ${container}`)
                }
              }
            } catch (recErr) {
              console.warn('refresh: reconciliation attempt failed', recErr)
            }
          }
        }
      } catch (ingestErr) {
        console.warn('refresh: ingesting canonical shipment into processes failed', ingestErr)
      }
    } catch (err) {
      console.error('refresh: Supabase save failed', err)
      return respondWithSchema(
        { error: `Supabase save failed: ${String(err)}` },
        RefreshErrorResponseSchema,
        500,
      )
    }

    return respondWithSchema(
      { ok: true, container: String(container) },
      RefreshSuccessResponseSchema,
      200,
    )
  } catch (err) {
    console.error('refresh error', err)
    return respondWithSchema({ error: String(err) }, RefreshErrorResponseSchema, 500)
  }
}

export const GET = () => respondWithSchema({ ok: true }, RefreshHealthResponseSchema, 200)
