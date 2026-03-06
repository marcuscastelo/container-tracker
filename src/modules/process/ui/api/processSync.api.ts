import { typedFetch } from '~/shared/api/typedFetch'
import { SyncAllProcessesResponseSchema } from '~/shared/api-schemas/processes.schemas'

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
