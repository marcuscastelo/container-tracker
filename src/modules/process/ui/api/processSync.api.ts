import { z } from 'zod'
import { TypedFetchError, typedFetch } from '~/shared/api/typedFetch'
import {
  ProcessesSyncStatusResponseSchema,
  SyncAllProcessesBusinessErrorResponseSchema,
  SyncAllProcessesSuccessResponseSchema,
  SyncProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

export type SyncAllProcessesSuccessResponse = z.infer<typeof SyncAllProcessesSuccessResponseSchema>
export type SyncAllProcessesBusinessErrorResponse = z.infer<
  typeof SyncAllProcessesBusinessErrorResponseSchema
>

export type SyncAllProcessesRequestResult =
  | {
      readonly httpStatus: 200
      readonly payload: SyncAllProcessesSuccessResponse
    }
  | {
      readonly httpStatus: 422
      readonly payload: SyncAllProcessesBusinessErrorResponse
    }

export async function syncAllProcessesRequest(): Promise<SyncAllProcessesRequestResult> {
  try {
    const payload = await typedFetch(
      '/api/processes/sync',
      {
        method: 'POST',
      },
      SyncAllProcessesSuccessResponseSchema,
    )

    return {
      httpStatus: 200,
      payload,
    }
  } catch (error) {
    if (error instanceof TypedFetchError && error.status === 422) {
      return {
        httpStatus: 422,
        payload: SyncAllProcessesBusinessErrorResponseSchema.parse(error.body),
      }
    }

    throw error
  }
}

export async function syncProcessRequest(processId: string): Promise<{
  readonly ok: true
  readonly processId: string
  readonly syncedContainers: number
}> {
  return typedFetch(
    `/api/processes/${encodeURIComponent(processId)}/sync`,
    {
      method: 'POST',
    },
    SyncProcessResponseSchema,
  )
}

export async function fetchProcessesSyncStatus(processIds: readonly string[]) {
  const searchParams = new URLSearchParams()
  if (processIds.length > 0) {
    searchParams.set('processIds', processIds.join(','))
  }

  const query = searchParams.toString()
  return typedFetch(
    query.length === 0 ? '/api/processes/sync-status' : `/api/processes/sync-status?${query}`,
    {
      headers: {
        'x-process-read-trigger': 'dashboard_realtime_reconciliation',
      },
    },
    ProcessesSyncStatusResponseSchema,
  )
}
