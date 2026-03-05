import { describe, expect, it, vi } from 'vitest'

import { createRefreshRestContainerUseCase } from '~/modules/tracking/application/usecases/refresh-rest-container.usecase'

describe('refresh-rest-container use case', () => {
  it('returns container_not_found when container does not exist', async () => {
    const useCase = createRefreshRestContainerUseCase({
      containerLookup: {
        findByNumbers: vi.fn(async () => ({ containers: [] })),
      },
      enqueueSyncRequest: {
        enqueueSyncRequest: vi.fn(),
      },
    })

    const result = await useCase({
      container: 'MSCU1234567',
      provider: 'msc',
    })

    expect(result.kind).toBe('container_not_found')
    if (result.kind === 'container_not_found') {
      expect(result.container).toBe('MSCU1234567')
    }
  })

  it('returns queued with deduped=false when sync request is newly created', async () => {
    const enqueueSyncRequest = vi.fn(async () => ({
      id: '07f5958b-b9df-4163-a6c4-feaed0229121',
      status: 'PENDING' as const,
      isNew: true,
    }))

    const useCase = createRefreshRestContainerUseCase({
      containerLookup: {
        findByNumbers: vi.fn(async () => ({
          containers: [{ id: 'container-1' }],
        })),
      },
      enqueueSyncRequest: {
        enqueueSyncRequest,
      },
    })

    const result = await useCase({
      container: 'MRKU1234567',
      provider: 'maersk',
    })

    expect(result.kind).toBe('queued')
    if (result.kind === 'queued') {
      expect(result.syncRequestId).toBe('07f5958b-b9df-4163-a6c4-feaed0229121')
      expect(result.queued).toBe(true)
      expect(result.deduped).toBe(false)
    }

    expect(enqueueSyncRequest).toHaveBeenCalledWith({
      provider: 'maersk',
      refType: 'container',
      refValue: 'MRKU1234567',
      priority: 0,
    })
  })

  it('returns queued with deduped=true when open sync request already exists', async () => {
    const useCase = createRefreshRestContainerUseCase({
      containerLookup: {
        findByNumbers: vi.fn(async () => ({
          containers: [{ id: 'container-1' }],
        })),
      },
      enqueueSyncRequest: {
        enqueueSyncRequest: vi.fn(async () => ({
          id: 'f2d57ec5-ff6a-46f7-89dc-6f0131f46f3d',
          status: 'LEASED' as const,
          isNew: false,
        })),
      },
    })

    const result = await useCase({
      container: 'MSCU7654321',
      provider: 'msc',
    })

    expect(result.kind).toBe('queued')
    if (result.kind === 'queued') {
      expect(result.queued).toBe(true)
      expect(result.deduped).toBe(true)
    }
  })
})
