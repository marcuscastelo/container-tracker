import { describe, expect, it, vi } from 'vitest'
import { createSyncDashboardEnqueueService } from '~/capabilities/sync/application/services/sync-dashboard-enqueue.service'

describe('sync-dashboard-enqueue.service', () => {
  it('classifies new enqueues, duplicate open requests, batch duplicates, and enqueue failures', async () => {
    const enqueueContainerSyncRequest = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'sync-1',
        status: 'PENDING' as const,
        isNew: true,
      })
      .mockResolvedValueOnce({
        id: 'sync-2',
        status: 'PENDING' as const,
        isNew: false,
      })
      .mockRejectedValueOnce(new Error('rpc failed'))

    const service = createSyncDashboardEnqueueService({
      queuePort: {
        enqueueContainerSyncRequest,
        getSyncRequestStatuses: vi.fn(),
      },
    })

    const result = await service.enqueue({
      tenantId: 'tenant-1',
      mode: 'manual',
      targets: [
        {
          processId: 'process-1',
          processReference: 'REF-001',
          containerNumber: 'MSCU1234567',
          provider: 'msc',
        },
        {
          processId: 'process-2',
          processReference: 'REF-002',
          containerNumber: 'MSCU1234567',
          provider: 'msc',
        },
        {
          processId: 'process-3',
          processReference: 'REF-003',
          containerNumber: 'MRKU7654321',
          provider: 'maersk',
        },
        {
          processId: 'process-4',
          processReference: 'REF-004',
          containerNumber: 'OOLU1234567',
          provider: 'one',
        },
      ],
    })

    expect(enqueueContainerSyncRequest).toHaveBeenCalledTimes(3)
    expect(result).toEqual({
      enqueuedTargets: [
        {
          processId: 'process-1',
          processReference: 'REF-001',
          containerNumber: 'MSCU1234567',
          provider: 'msc',
          syncRequestId: 'sync-1',
        },
      ],
      skippedTargets: [
        {
          processId: 'process-2',
          processReference: 'REF-002',
          containerNumber: 'MSCU1234567',
          provider: 'msc',
          reasonCode: 'DUPLICATE_OPEN_REQUEST',
          reasonMessage:
            'Target already has an open sync request or was already included in this batch.',
        },
        {
          processId: 'process-3',
          processReference: 'REF-003',
          containerNumber: 'MRKU7654321',
          provider: 'maersk',
          reasonCode: 'DUPLICATE_OPEN_REQUEST',
          reasonMessage:
            'Target already has an open sync request or was already included in this batch.',
        },
      ],
      failedTargets: [
        {
          processId: 'process-4',
          processReference: 'REF-004',
          containerNumber: 'OOLU1234567',
          provider: 'one',
          reasonCode: 'ENQUEUE_FAILED',
          reasonMessage: 'Failed to enqueue dashboard sync request.',
        },
      ],
      newSyncRequestIds: ['sync-1'],
    })
  })
})
