import { typedFetch } from '~/shared/api/typedFetch'
import {
  ProcessesSyncStatusResponseSchema,
  SyncAllProcessesResponseSchema,
  SyncProcessResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

export async function syncAllProcessesRequest(): Promise<{
  readonly ok: true
  readonly syncedProcesses: number
  readonly syncedContainers: number
}> {
  return typedFetch(
    '/api/processes/sync',
    {
      method: 'POST',
    },
    SyncAllProcessesResponseSchema,
  )
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
