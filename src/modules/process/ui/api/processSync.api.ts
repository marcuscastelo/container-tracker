import { typedFetch } from '~/shared/api/typedFetch'
import {
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
