import type z4 from 'zod/v4'
import { mapParsedStatusToF1 } from '~/modules/container/application/toCanonical.adapter'
import {
  fetchAndSanitizeStatus,
  ingestCanonicalShipment,
  respondWithSchema,
} from '~/modules/container-events/infrastructure/api/refresh/helpers'
import { getProvider } from '~/modules/container-events/infrastructure/api/refresh/refresh-providers'
import {
  RefreshErrorResponseSchema,
  RefreshHealthResponseSchema,
  RefreshRedirectResponseSchema,
  RefreshRequestSchema,
  RefreshSuccessResponseSchema,
} from '~/modules/container-events/infrastructure/api/refresh/schemas'
import { jsonResponse, parseBody } from '~/shared/api/typedRoute'

function handleMaerskRedirect(container: string) {
  const redirectPath = `/api/refresh-maersk/${encodeURIComponent(container)}`
  const payload = { redirect: redirectPath }
  return respondWithSchema(payload, RefreshRedirectResponseSchema, 307, {
    Location: redirectPath,
  })
}

// --- Main Handlers ---
export async function POST({ request }: { request: Request }) {
  try {
    let parsedReqData: z4.infer<typeof RefreshRequestSchema>
    try {
      parsedReqData = await parseBody(request, RefreshRequestSchema)
    } catch (err) {
      return jsonResponse(
        { error: `invalid request: ${String(err)}` },
        400,
        RefreshErrorResponseSchema,
      )
    }
    const container = parsedReqData.container
    const provider = parsedReqData.carrier || 'unknown'

    if (provider === 'maersk') {
      return handleMaerskRedirect(container)
    }

    const handler = getProvider(String(provider))
    if (!handler) {
      console.error(`refresh: no handler for carrier '${provider}'`)
      return respondWithSchema(
        { error: `no handler for carrier ${provider}` },
        RefreshErrorResponseSchema,
        400,
      )
    }

    const { parsedStatus, error: fetchError } = await fetchAndSanitizeStatus(handler, container)
    if (fetchError) {
      return respondWithSchema({ error: fetchError }, RefreshErrorResponseSchema, 502)
    }

    try {
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
      // NOTE: saving is currently disabled intentionally; keep code for future re-enable
      // await containerStatusUseCases.saveContainerStatus(String(container), canonicalStatus)
      console.log(`refresh: (skipped) saved canonical container ${container} to Supabase`)
      await ingestCanonicalShipment(canonicalStatus, container)
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
