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
        new Response(
          JSON.stringify({
            ok: true,
            summary: {
              requestedProcesses: 2,
              requestedContainers: 5,
              enqueued: 5,
              skipped: 0,
              failed: 0,
            },
            enqueuedTargets: [
              {
                processId: 'process-1',
                processReference: 'REF-1',
                containerNumber: 'MSCU1234567',
                provider: 'msc',
                syncRequestId: 'sync-1',
              },
              {
                processId: 'process-2',
                processReference: 'REF-2',
                containerNumber: 'MRKU7654321',
                provider: 'maersk',
                syncRequestId: 'sync-2',
              },
              {
                processId: 'process-3',
                processReference: 'REF-3',
                containerNumber: 'OOLU1234567',
                provider: 'one',
                syncRequestId: 'sync-3',
              },
              {
                processId: 'process-4',
                processReference: 'REF-4',
                containerNumber: 'MEDU1234567',
                provider: 'msc',
                syncRequestId: 'sync-4',
              },
              {
                processId: 'process-5',
                processReference: 'REF-5',
                containerNumber: 'TGHU1234567',
                provider: 'pil',
                syncRequestId: 'sync-5',
              },
            ],
            skippedTargets: [],
            failedTargets: [],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
    )

    const result = await syncAllProcessesRequest()

    expect(fetchSpy).toHaveBeenCalledWith('/api/processes/sync', {
      method: 'POST',
    })
    expect(result.httpStatus).toBe(200)
    expect(result.payload.summary.enqueued).toBe(5)
  })

  it('returns structured 422 business errors without throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: 'sync_dashboard_failed_no_targets_enqueued',
            summary: {
              requestedProcesses: 1,
              requestedContainers: 1,
              enqueued: 0,
              skipped: 0,
              failed: 1,
            },
            enqueuedTargets: [],
            skippedTargets: [],
            failedTargets: [
              {
                processId: 'process-1',
                processReference: 'REF-1',
                containerNumber: 'MSCU1234567',
                provider: 'msc',
                reasonCode: 'ENQUEUE_FAILED',
                reasonMessage: 'Failed to enqueue dashboard sync request.',
              },
            ],
          }),
          {
            status: 422,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
    )

    const result = await syncAllProcessesRequest()

    expect(result).toEqual({
      httpStatus: 422,
      payload: {
        ok: false,
        error: 'sync_dashboard_failed_no_targets_enqueued',
        summary: {
          requestedProcesses: 1,
          requestedContainers: 1,
          enqueued: 0,
          skipped: 0,
          failed: 1,
        },
        enqueuedTargets: [],
        skippedTargets: [],
        failedTargets: [
          {
            processId: 'process-1',
            processReference: 'REF-1',
            containerNumber: 'MSCU1234567',
            provider: 'msc',
            reasonCode: 'ENQUEUE_FAILED',
            reasonMessage: 'Failed to enqueue dashboard sync request.',
          },
        ],
      },
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
