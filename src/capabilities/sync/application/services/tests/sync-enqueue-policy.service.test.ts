import { describe, expect, it, vi } from 'vitest'
import { createSyncEnqueuePolicyService } from '~/capabilities/sync/application/services/sync-enqueue-policy.service'

describe('sync-enqueue-policy.service', () => {
  it('dedupes duplicate targets inside a single enqueue request', async () => {
    const enqueueContainerSyncRequest = vi.fn(async () => ({
      id: 'sync-1',
      status: 'PENDING' as const,
      isNew: true,
    }))

    const service = createSyncEnqueuePolicyService({
      queuePort: {
        enqueueContainerSyncRequest,
        getSyncRequestStatuses: vi.fn(),
      },
    })

    const result = await service.enqueue({
      tenantId: 'tenant-a',
      mode: 'manual',
      targets: [
        {
          processId: 'process-1',
          provider: 'msc',
          containerNumber: 'MSCU1234567',
        },
        {
          processId: 'process-1',
          provider: 'msc',
          containerNumber: 'MSCU1234567',
        },
      ],
    })

    expect(enqueueContainerSyncRequest).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      requestedTargets: 2,
      queuedTargets: 1,
      syncRequestIds: ['sync-1'],
      requests: [
        {
          processId: 'process-1',
          containerNumber: 'MSCU1234567',
          syncRequestId: 'sync-1',
          deduped: false,
        },
        {
          processId: 'process-1',
          containerNumber: 'MSCU1234567',
          syncRequestId: 'sync-1',
          deduped: true,
        },
      ],
    })
  })

  it('marks repeated enqueue attempts as deduped when the shared queue reuses an open request', async () => {
    const enqueueContainerSyncRequest = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'sync-1',
        status: 'PENDING',
        isNew: true,
      })
      .mockResolvedValueOnce({
        id: 'sync-1',
        status: 'PENDING',
        isNew: false,
      })

    const service = createSyncEnqueuePolicyService({
      queuePort: {
        enqueueContainerSyncRequest,
        getSyncRequestStatuses: vi.fn(),
      },
    })

    await service.enqueue({
      tenantId: 'tenant-a',
      mode: 'manual',
      targets: [
        {
          processId: 'process-1',
          provider: 'msc',
          containerNumber: 'MSCU1234567',
        },
      ],
    })

    const secondResult = await service.enqueue({
      tenantId: 'tenant-a',
      mode: 'manual',
      targets: [
        {
          processId: 'process-1',
          provider: 'msc',
          containerNumber: 'MSCU1234567',
        },
      ],
    })

    expect(enqueueContainerSyncRequest).toHaveBeenCalledTimes(2)
    expect(secondResult).toEqual({
      requestedTargets: 1,
      queuedTargets: 1,
      syncRequestIds: ['sync-1'],
      requests: [
        {
          processId: 'process-1',
          containerNumber: 'MSCU1234567',
          syncRequestId: 'sync-1',
          deduped: true,
        },
      ],
    })
  })
})
