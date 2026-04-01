import type { SyncUseCases } from '~/capabilities/sync/application/sync.usecases'
import { ProcessesSyncStatusQuerySchema } from '~/capabilities/sync/interface/http/sync.schemas'
import { toProcessesSyncStatusResponse } from '~/capabilities/sync/presenter/sync-response.presenter'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'
import { ProcessesSyncStatusResponseSchema } from '~/shared/api-schemas/processes.schemas'
import {
  readAuditedTriggerSource,
  runWithReadRequestAudit,
} from '~/shared/observability/readRequestMetrics'

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
    return runWithReadRequestAudit(
      {
        endpoint: '/api/processes/sync-status',
        projection: 'ProcessesSyncStatusResponse',
        triggeredBy: readAuditedTriggerSource(request),
      },
      async () => {
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

          const result = await syncUseCases.getSyncStatus(
            parsedQuery.data.processIds === undefined
              ? {}
              : { processIds: parsedQuery.data.processIds },
          )
          const response = toProcessesSyncStatusResponse(result)
          return jsonResponse(response, 200, ProcessesSyncStatusResponseSchema, {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            Pragma: 'no-cache',
            Expires: '0',
          })
        } catch (err) {
          console.error('GET /api/processes/sync-status error:', err)
          return mapErrorToResponse(err)
        }
      },
    )
  }

  return {
    listProcessesSyncStatus,
  }
}

export type SyncStatusControllers = ReturnType<typeof createSyncStatusControllers>
