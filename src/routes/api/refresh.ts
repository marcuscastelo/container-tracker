import { ZodError } from 'zod'
import type z4 from 'zod/v4'
import type { F1Shipment } from '~/modules/container/domain/schemas/canonical.schema'
import * as CmaApiSchemas from '~/modules/container/infrastructure/schemas/api/cmacgm.api.schema'
import * as MaerskApiSchemas from '~/modules/container/infrastructure/schemas/api/maersk.api.schema'
import * as MscApiSchemas from '~/modules/container/infrastructure/schemas/api/msc.api.schema'
import {
  mapApiToCanonnicalEvents,
  type ProviderContainerEvents,
} from '~/modules/container-events/application/toCanonical.adapter'
import { ingestCanonicalShipment } from '~/modules/container-events/infrastructure/api/refresh/api'
import {
  fetchAndSanitizeApiEvents,
  respondWithSchema,
} from '~/modules/container-events/infrastructure/api/refresh/helpers'
import { getRestProvider } from '~/modules/container-events/infrastructure/api/refresh/refresh-providers'
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

    let handler
    try {
      handler = getRestProvider(String(provider))
    } catch (err) {
      // Zod parsing or other provider lookup errors can be noisy; log a concise message
      if (err instanceof ZodError) {
        try {
          console.error(`refresh: invalid provider value='${provider}'`, err.format())
        } catch {
          console.error(`refresh: invalid provider value='${provider}'`, String(err))
        }
      } else {
        console.error(`refresh: failed to resolve provider='${provider}'`, err)
      }
      return respondWithSchema(
        { error: `invalid carrier/provider: ${String(provider)}` },
        RefreshSchemas.responses.error,
        400,
      )
    }

    const fetchResult = await fetchAndSanitizeApiEvents(handler, container)
    if (!fetchResult.ok) {
      return fetchResult.response
    }
    if (!fetchResult.data.apiEvents) {
      console.error('refresh: no events fetched')
      return respondWithSchema({ error: 'no events fetched' }, RefreshSchemas.responses.error, 502)
    }

    console.debug(`refresh: fetched events for provider='${provider}' container='${container}'`)
    const mappedResult = mapApiToCanonnicalEvents(fetchResult.data.apiEvents)
    if (!mappedResult.ok) {
      console.error('refresh: mapping to canonical failed', mappedResult.response)
      return mappedResult.response
    }
    console.debug(
      `refresh: mapped to canonical for provider='${provider}' container='${container}'`,
    )
    console.debug(`refresh: cannonical shipment:`, mappedResult.data)

    try {
      await ingestCanonicalShipment(mappedResult.data, container)
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
    // Improve server-side error logging: prefer structured outputs for Zod errors
    try {
      if (err instanceof ZodError) {
        console.error('refresh error (validation):', err.format())
      } else if (err instanceof Error) {
        console.error('refresh error:', err.message)
        console.error(err.stack)
      } else {
        console.error('refresh error (unknown):', err)
      }
    } catch (loggingErr) {
      console.error('refresh error (failed while logging):', err, loggingErr)
    }

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

export const GET = () => respondWithSchema({ ok: true }, RefreshSchemas.responses.health, 200)
