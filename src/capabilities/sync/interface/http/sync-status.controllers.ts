import type { SyncUseCases } from '~/capabilities/sync/application/sync.usecases'
import { ProcessesSyncStatusQuerySchema } from '~/capabilities/sync/interface/http/sync.schemas'
import { toProcessesSyncStatusResponse } from '~/capabilities/sync/presenter/sync-response.presenter'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'
import { ProcessesSyncStatusResponseSchema } from '~/shared/api-schemas/processes.schemas'

type SyncStatusControllersDeps = {
  readonly syncUseCases: Pick<SyncUseCases, 'getSyncStatus'>
}

export function createSyncStatusControllers(deps: SyncStatusControllersDeps) {
  const { syncUseCases } = deps

  async function listProcessesSyncStatus({
    request,
  }: {
    readonly request: Request
  }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const parsedQuery = ProcessesSyncStatusQuerySchema.safeParse({
        processIds: url.searchParams.get('processIds') ?? undefined,
      })

      if (!parsedQuery.success) {
        return jsonResponse(
          { error: `Invalid sync-status query: ${parsedQuery.error.message}` },
          400,
        )
      }

      const result = await syncUseCases.getSyncStatus({
        processIds: parsedQuery.data.processIds,
      })
      const response = toProcessesSyncStatusResponse(result)
      const validated = ProcessesSyncStatusResponseSchema.parse(response)

      return new Response(JSON.stringify(validated), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      })
    } catch (err) {
      console.error('GET /api/processes/sync-status error:', err)
      return mapErrorToResponse(err)
    }
  }

  return {
    listProcessesSyncStatus,
  }
}

export type SyncStatusControllers = ReturnType<typeof createSyncStatusControllers>
