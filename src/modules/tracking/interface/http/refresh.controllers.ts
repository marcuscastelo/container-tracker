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

type RefreshSyncStatus = 'PENDING' | 'LEASED' | 'DONE' | 'FAILED' | 'NOT_FOUND'

type RefreshSyncRequestStatus = {
  readonly syncRequestId: string
  readonly status: RefreshSyncStatus
  readonly lastError: string | null
  readonly updatedAt: string | null
  readonly refValue: string | null
}

type RefreshControllersDeps = {
  readonly refreshRestUseCase: RefreshRestUseCase
  readonly getSyncRequestStatuses: (command: {
    readonly syncRequestIds: readonly string[]
  }) => Promise<{
    readonly allTerminal: boolean
    readonly requests: readonly RefreshSyncRequestStatus[]
  }>
}

function mapRefreshRestResult(result: RefreshRestContainerResult): Response {
  if (result.kind === 'container_not_found') {
    return respondWithSchema(
      {
        error: `container ${result.container} not found in the system. Create a process first.`,
      },
      RefreshSchemas.responses.error,
      404,
    )
  }

  return respondWithSchema(
    {
      ok: true,
      container: result.container,
      syncRequestId: result.syncRequestId,
      queued: result.queued,
      deduped: result.deduped,
    },
    RefreshSchemas.responses.success,
    202,
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

  function health(): Response {
    return respondWithSchema({ ok: true }, RefreshSchemas.responses.health, 200)
  }

  async function status({ request }: { request: Request }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const parsedQuery = RefreshSchemas.refreshStatusQuery.safeParse({
        sync_request_id: url.searchParams.getAll('sync_request_id'),
      })

      if (!parsedQuery.success) {
        return respondWithSchema(
          { error: `Invalid query: ${parsedQuery.error.message}` },
          RefreshSchemas.responses.error,
          400,
        )
      }

      const result = await deps.getSyncRequestStatuses({
        syncRequestIds: parsedQuery.data.sync_request_id,
      })

      return respondWithSchema(
        {
          ok: true,
          allTerminal: result.allTerminal,
          requests: result.requests,
        },
        RefreshSchemas.responses.status,
        200,
        {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      )
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  return {
    refresh,
    health,
    status,
  }
}

export type RefreshControllers = ReturnType<typeof createRefreshControllers>
