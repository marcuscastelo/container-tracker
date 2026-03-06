import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  syncAllProcessesRequest,
  syncProcessRequest,
} from '~/modules/process/ui/api/processSync.api'

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

describe('syncProcessRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the process scoped sync endpoint and returns parsed counters', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true, processId: 'process-123', syncedContainers: 2 }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
    )

    const result = await syncProcessRequest('process-123')

    expect(fetchSpy).toHaveBeenCalledWith('/api/processes/process-123/sync', {
      method: 'POST',
    })
    expect(result).toEqual({
      ok: true,
      processId: 'process-123',
      syncedContainers: 2,
    })
  })
})
