import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncAllProcessesRequest } from '~/modules/process/ui/api/processSync.api'

describe('syncAllProcessesRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the global process sync endpoint and returns parsed counters', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true, syncedProcesses: 2, syncedContainers: 5 }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
    )

    const result = await syncAllProcessesRequest()

    expect(fetchSpy).toHaveBeenCalledWith('/api/processes/sync', {
      method: 'POST',
    })
    expect(result).toEqual({
      ok: true,
      syncedProcesses: 2,
      syncedContainers: 5,
    })
  })
})
