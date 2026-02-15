import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import { sanitizePayload } from '~/modules/tracking/application/apiHelpers'
import type { Provider } from '~/modules/tracking/domain/model/provider'
import { PROVIDERS } from '~/modules/tracking/domain/model/provider'
import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'
import { isRestCarrier } from '~/modules/tracking/infrastructure/carriers/fetchers/is-rest-carrier'
import { RefreshSchemas } from '~/modules/tracking/interface/http/refresh.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { respondWithSchema } from '~/shared/api/respondWithSchema'
import { parseBody } from '~/shared/api/typedRoute'

const { trackingUseCases } = bootstrapTrackingModule()

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
    if (!PROVIDERS.some((p) => p === provider)) {
      return respondWithSchema(
        { error: `invalid carrier/provider: ${provider}` },
        RefreshSchemas.responses.error,
        400,
      )
    }

    if (!isRestCarrier(provider)) {
      return respondWithSchema(
        { error: `no REST fetcher for carrier: ${provider}` },
        RefreshSchemas.responses.error,
        400,
      )
    }

    // Look up the container in our DB to get its UUID
    const containerResult = await containerUseCases.findByNumbers({
      containerNumbers: [container],
    })
    const containerRecord = containerResult.containers[0] ?? null
    if (!containerRecord) {
      return respondWithSchema(
        { error: `container ${container} not found in the system. Create a process first.` },
        RefreshSchemas.responses.error,
        404,
      )
    }

    // Fetch from carrier API, save snapshot, and run the full pipeline
    const result = await trackingUseCases.fetchAndProcess(containerRecord.id, container, provider)

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
      `refresh: saved snapshot ${result.snapshot.id} for container ${container} (provider=${provider}), ` +
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
