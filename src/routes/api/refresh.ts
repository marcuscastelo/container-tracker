import type z4 from 'zod/v4'
import { mapParsedStatusToF1 } from '~/modules/container/application/toCanonical.adapter'
import type { F1Shipment } from '~/modules/container/domain/schemas/canonical.schema'
import { ingestCanonicalShipment } from '~/modules/container-events/infrastructure/api/refresh/api'
import {
  fetchAndSanitizeStatus,
  respondWithSchema,
} from '~/modules/container-events/infrastructure/api/refresh/helpers'
import { getProvider } from '~/modules/container-events/infrastructure/api/refresh/refresh-providers'
import { RefreshSchemas } from '~/modules/container-events/infrastructure/api/refresh/schemas'
import { jsonResponse, parseBody } from '~/shared/api/typedRoute'

function handleMaerskRedirect(container: string) {
  const redirectPath = `/api/refresh-maersk/${encodeURIComponent(container)}`
  const payload = { redirect: redirectPath }
  return respondWithSchema(payload, RefreshSchemas.responses.redirect, 307, {
    Location: redirectPath,
  })
}

// --- Main Handlers ---
export async function POST({ request }: { request: Request }) {
  try {
    const parsedReqData = await parseRequestData(request)
    if (!parsedReqData.ok) {
      return parsedReqData.response
    }

    const { container, provider } = parsedReqData.data

    if (provider === 'maersk') {
      return handleMaerskRedirect(container)
    }

    const handler = getProvider(String(provider))
    if (!handler) {
      console.error(`refresh: no handler for carrier '${provider}'`)
      return respondWithSchema(
        { error: `no handler for carrier ${provider}` },
        RefreshSchemas.responses.error,
        400,
      )
    }

    const { parsedStatus, error: fetchError } = await fetchAndSanitizeStatus(handler, container)
    if (fetchError) {
      return respondWithSchema({ error: fetchError }, RefreshSchemas.responses.error, 502)
    }

    const mappedResult = mapStatusToCanonical(parsedStatus, container, provider)
    if (!mappedResult.ok) {
      return mappedResult.response
    }

    try {
      await ingestCanonicalShipment(mappedResult.shipment, container)
    } catch (err) {
      console.error('refresh: Supabase save failed', err)
      return respondWithSchema(
        { error: `Supabase save failed: ${String(err)}` },
        RefreshSchemas.responses.error,
        500,
      )
    }

    return respondWithSchema(
      { ok: true, container: String(container) },
      RefreshSchemas.responses.success,
      200,
    )
  } catch (err) {
    console.error('refresh error', err)
    return respondWithSchema({ error: String(err) }, RefreshSchemas.responses.error, 500)
  }
}

// --- Modularized helpers ---

async function parseRequestData(
  request: Request,
): Promise<
  { ok: true; data: { container: string; provider: string } } | { ok: false; response: Response }
> {
  try {
    const parsedReqData: z4.infer<typeof RefreshSchemas.request> = await parseBody(
      request,
      RefreshSchemas.request,
    )
    return {
      ok: true,
      data: {
        container: parsedReqData.container,
        provider: parsedReqData.carrier || 'unknown',
      },
    }
  } catch (err) {
    return {
      ok: false,
      response: jsonResponse(
        { error: `invalid request: ${String(err)}` },
        400,
        RefreshSchemas.responses.error,
      ),
    }
  }
}

function mapStatusToCanonical(
  parsedStatus: unknown,
  container: string,
  provider: string,
): { ok: true; shipment: F1Shipment } | { ok: false; response: Response } {
  const mapped = mapParsedStatusToF1(parsedStatus, String(container), provider)
  if (!mapped.ok) {
    console.error('refresh: mapping to canonical failed', mapped.error)
    return {
      ok: false,
      response: respondWithSchema(
        { error: `mapping to canonical failed: ${mapped.error}` },
        RefreshSchemas.responses.error,
        500,
      ),
    }
  }
  return { ok: true, shipment: mapped.shipment }
}

export const GET = () => respondWithSchema({ ok: true }, RefreshSchemas.responses.health, 200)
