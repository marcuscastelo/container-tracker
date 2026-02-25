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

export type RefreshControllersDeps = {
  readonly refreshRestUseCase: RefreshRestUseCase
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

  return {
    refresh,
    health,
  }
}

export type RefreshControllers = ReturnType<typeof createRefreshControllers>
