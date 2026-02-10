import { supabaseProcessRepository } from '~/modules/process'
import { trackingUseCases } from '~/modules/tracking'
import { respondWithSchema, sanitizePayload } from '~/modules/tracking/application/apiHelpers'
import { RefreshSchemas } from '~/modules/tracking/application/refreshSchemas'
import { type Provider, ProviderSchema } from '~/modules/tracking/domain/provider'
import { isRestCarrier } from '~/modules/tracking/infrastructure/fetchers'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { parseBody } from '~/shared/api/typedRoute'

function handleMaerskRedirect(container: string): Response {
  const redirectPath = `/api/refresh-maersk/${encodeURIComponent(container)}`
  const payload = { redirect: redirectPath }
  return respondWithSchema(payload, RefreshSchemas.responses.redirect, 307, {
    Location: redirectPath,
  })
}

// --- Main Handler ---
export async function POST({ request }: { request: Request }): Promise<Response> {
  try {
    const extractResult = await extractContainerAndProvider(request)
    if (!extractResult.ok) {
      return extractResult.response
    }
    const { container, provider } = extractResult.data

    // Maersk uses Puppeteer — redirect to the dedicated route
    if (provider === 'maersk') {
      return handleMaerskRedirect(container)
    }

    // Validate provider
    const providerResult = ProviderSchema.safeParse(provider)
    if (!providerResult.success) {
      return respondWithSchema(
        { error: `invalid carrier/provider: ${provider}` },
        RefreshSchemas.responses.error,
        400,
      )
    }

    const validProvider = providerResult.data

    if (!isRestCarrier(validProvider)) {
      return respondWithSchema(
        { error: `no REST fetcher for carrier: ${validProvider}` },
        RefreshSchemas.responses.error,
        400,
      )
    }

    // Look up the container in our DB to get its UUID
    const containerRes = await supabaseProcessRepository.fetchContainerByNumber(container)
    if (!containerRes.success) {
      return respondWithSchema(
        { error: `Failed to lookup container: ${containerRes.error?.message ?? 'Unknown error'}` },
        RefreshSchemas.responses.error,
        500,
      )
    }

    const containerRecord = containerRes.data
    if (!containerRecord) {
      return respondWithSchema(
        { error: `container ${container} not found in the system. Create a process first.` },
        RefreshSchemas.responses.error,
        404,
      )
    }

    // Fetch from carrier API, save snapshot, and run the full pipeline
    const result = await trackingUseCases.fetchAndProcess(
      containerRecord.id,
      container,
      validProvider,
    )

    if (!result) {
      return respondWithSchema(
        { error: 'fetch failed: no result created' },
        RefreshSchemas.responses.error,
        502,
      )
    }

    // Sanitize payload for response logging
    if (result.snapshot.payload) {
      sanitizePayload(result.snapshot.payload)
    }

    console.log(
      `refresh: saved snapshot ${result.snapshot.id} for container ${container} (provider=${validProvider}), ` +
        `new observations: ${result.pipeline.newObservations.length}, ` +
        `new alerts: ${result.pipeline.newAlerts.length}, ` +
        `status: ${result.pipeline.status}`,
    )

    return respondWithSchema(
      { ok: true, container: String(container), snapshotId: result.snapshot.id },
      RefreshSchemas.responses.success,
      200,
    )
  } catch (err) {
    console.error('refresh error:', err)
    return mapErrorToResponse(err)
  }
}

// --- Helpers ---

async function extractContainerAndProvider(
  request: Request,
): Promise<
  { ok: true; data: { container: string; provider: Provider } } | { ok: false; response: Response }
> {
  try {
    const body = await parseBody(request, RefreshSchemas.request)
    return {
      ok: true,
      data: {
        container: body.container,
        provider: body.carrier,
      },
    }
  } catch (err) {
    return {
      ok: false,
      response: respondWithSchema(
        { error: `invalid request: ${String(err)}` },
        RefreshSchemas.responses.error,
        400,
      ),
    }
  }
}

export function GET(): Response {
  return respondWithSchema({ ok: true }, RefreshSchemas.responses.health, 200)
}
