import type {
  RefreshMaerskContainerCommand,
  RefreshMaerskContainerResult,
} from '~/modules/tracking/application/usecases/refresh-maersk-container.usecase'
import type {
  RefreshRestContainerCommand,
  RefreshRestContainerResult,
} from '~/modules/tracking/application/usecases/refresh-rest-container.usecase'
import { RefreshSchemas } from '~/modules/tracking/interface/http/refresh.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { respondWithSchema } from '~/shared/api/respondWithSchema'
import { parseBody } from '~/shared/api/typedRoute'

type RefreshRestUseCase = (
  command: RefreshRestContainerCommand,
) => Promise<RefreshRestContainerResult>

type RefreshMaerskUseCase = (
  command: RefreshMaerskContainerCommand,
) => Promise<RefreshMaerskContainerResult>

export type RefreshControllersDeps = {
  readonly refreshRestUseCase: RefreshRestUseCase
  readonly refreshMaerskUseCase: RefreshMaerskUseCase
}

function toBooleanFlag(value: string | undefined): boolean {
  return value === '1' || value === 'true'
}

function toHeadlessFlag(value: string | undefined): boolean {
  if (value === undefined) return true
  return toBooleanFlag(value)
}

function toTimeoutMs(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '60000', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60000
}

function mapRefreshRestResult(result: RefreshRestContainerResult): Response {
  if (result.kind === 'redirect') {
    return respondWithSchema(
      { redirect: result.redirectPath },
      RefreshSchemas.responses.redirect,
      307,
      {
        Location: result.redirectPath,
      },
    )
  }

  if (result.kind === 'container_not_found') {
    return respondWithSchema(
      {
        error: `container ${result.container} not found in the system. Create a process first.`,
      },
      RefreshSchemas.responses.error,
      404,
    )
  }

  if (result.kind === 'no_rest_fetcher') {
    return respondWithSchema(
      {
        error: `no REST fetcher for carrier: ${result.provider}`,
      },
      RefreshSchemas.responses.error,
      400,
    )
  }

  console.log(
    `refresh: saved snapshot ${result.snapshotId} for container ${result.container} ` +
      `(status=${result.status}, new observations=${result.newObservationsCount}, ` +
      `new alerts=${result.newAlertsCount})`,
  )

  return respondWithSchema(
    {
      ok: true,
      container: result.container,
      snapshotId: result.snapshotId,
    },
    RefreshSchemas.responses.success,
    200,
  )
}

export function createRefreshControllers(deps: RefreshControllersDeps) {
  async function refresh({ request }: { request: Request }): Promise<Response> {
    try {
      const body = await parseBody(request, RefreshSchemas.refreshRequest)
      const result = await deps.refreshRestUseCase({
        container: body.container,
        provider: body.carrier,
      })
      return mapRefreshRestResult(result)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function refreshMaersk({
    params,
    request,
  }: {
    params: Record<string, string | undefined>
    request: Request
  }): Promise<Response> {
    try {
      const parsedParams = RefreshSchemas.maersk.params.safeParse(params ?? {})
      if (!parsedParams.success) {
        return respondWithSchema(
          { error: `invalid params: ${parsedParams.error.message}` },
          RefreshSchemas.maersk.responses.error,
          400,
        )
      }

      const url = new URL(request.url)
      const parsedQuery = RefreshSchemas.maersk.query.safeParse({
        headless: url.searchParams.get('headless') ?? undefined,
        userDataDir: url.searchParams.get('userDataDir') ?? undefined,
        hold: url.searchParams.get('hold') ?? undefined,
        timeout: url.searchParams.get('timeout') ?? undefined,
      })

      if (!parsedQuery.success) {
        return respondWithSchema(
          { error: `invalid query: ${parsedQuery.error.message}` },
          RefreshSchemas.maersk.responses.error,
          400,
        )
      }

      const result = await deps.refreshMaerskUseCase({
        container: parsedParams.data.container,
        headless: toHeadlessFlag(parsedQuery.data.headless),
        hold: toBooleanFlag(parsedQuery.data.hold),
        timeoutMs: toTimeoutMs(parsedQuery.data.timeout),
        userDataDir: parsedQuery.data.userDataDir ?? process.env.CHROME_USER_DATA_DIR ?? null,
      })

      if (result.kind === 'error') {
        return respondWithSchema(result.body, RefreshSchemas.maersk.responses.error, result.status)
      }

      return respondWithSchema(result.body, RefreshSchemas.maersk.responses.success, result.status)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  function health(): Response {
    return respondWithSchema({ ok: true }, RefreshSchemas.responses.health, 200)
  }

  return {
    refresh,
    refreshMaersk,
    health,
  }
}

export type RefreshControllers = ReturnType<typeof createRefreshControllers>
