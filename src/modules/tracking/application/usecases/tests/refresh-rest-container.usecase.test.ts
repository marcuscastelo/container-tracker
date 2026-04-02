import { describe, expect, it, vi } from 'vitest'
import { createRefreshRestContainerUseCase } from '~/modules/tracking/application/usecases/refresh-rest-container.usecase'

describe('refresh-rest-container use case', () => {
  it('returns container_not_found when container does not exist', async () => {
    const useCase = createRefreshRestContainerUseCase({
      containerLookup: {
        findByNumbers: vi.fn(async () => ({ containers: [] })),
      },
      processLookup: {
        findProcessById: vi.fn(async () => ({ process: null })),
      },
      containerCarrierMutation: {
        updateContainerCarrier: vi.fn(async () => undefined),
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
          containers: [
            {
              id: 'container-1',
              containerNumber: 'MRKU1234567',
              carrierCode: 'maersk',
              processId: 'process-1',
            },
          ],
        })),
      },
      processLookup: {
        findProcessById: vi.fn(async () => ({
          process: { id: 'process-1', carrier: 'maersk' },
        })),
      },
      containerCarrierMutation: {
        updateContainerCarrier: vi.fn(async () => undefined),
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
          containers: [
            {
              id: 'container-1',
              containerNumber: 'MSCU7654321',
              carrierCode: 'msc',
              processId: 'process-1',
            },
          ],
        })),
      },
      processLookup: {
        findProcessById: vi.fn(async () => ({
          process: { id: 'process-1', carrier: 'msc' },
        })),
      },
      containerCarrierMutation: {
        updateContainerCarrier: vi.fn(async () => undefined),
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

  it('queues PIL container refreshes through the shared REST sync path', async () => {
    const enqueueSyncRequest = vi.fn(async () => ({
      id: 'a15f86aa-f6db-470a-ae7a-555555555555',
      status: 'PENDING' as const,
      isNew: true,
    }))

    const useCase = createRefreshRestContainerUseCase({
      containerLookup: {
        findByNumbers: vi.fn(async () => ({
          containers: [
            {
              id: 'container-1',
              containerNumber: 'PCIU8712104',
              carrierCode: 'pil',
              processId: 'process-1',
            },
          ],
        })),
      },
      processLookup: {
        findProcessById: vi.fn(async () => ({
          process: { id: 'process-1', carrier: 'pil' },
        })),
      },
      containerCarrierMutation: {
        updateContainerCarrier: vi.fn(async () => undefined),
      },
      enqueueSyncRequest: {
        enqueueSyncRequest,
      },
    })

    const result = await useCase({
      container: 'PCIU8712104',
      provider: 'pil',
    })

    expect(result.kind).toBe('queued')
    expect(enqueueSyncRequest).toHaveBeenCalledWith({
      provider: 'pil',
      refType: 'container',
      refValue: 'PCIU8712104',
      priority: 0,
    })
  })

  it('self-heals stale container carrier codes when the owning process already uses the requested provider', async () => {
    const enqueueSyncRequest = vi.fn(async () => ({
      id: '0b68e4b8-b15b-4da0-9e8f-aaaaaaaaaaaa',
      status: 'PENDING' as const,
      isNew: true,
    }))
    const updateContainerCarrier = vi.fn(async () => undefined)

    const useCase = createRefreshRestContainerUseCase({
      containerLookup: {
        findByNumbers: vi.fn(async () => ({
          containers: [
            {
              id: 'container-1',
              containerNumber: 'DRYU2434190',
              carrierCode: 'unknown',
              processId: 'process-1',
            },
          ],
        })),
      },
      processLookup: {
        findProcessById: vi.fn(async () => ({
          process: { id: 'process-1', carrier: 'one' },
        })),
      },
      containerCarrierMutation: {
        updateContainerCarrier,
      },
      enqueueSyncRequest: {
        enqueueSyncRequest,
      },
    })

    const result = await useCase({
      container: 'DRYU2434190',
      provider: 'one',
    })

    expect(result.kind).toBe('queued')
    expect(updateContainerCarrier).toHaveBeenCalledWith({
      containerId: 'container-1',
      containerNumber: 'DRYU2434190',
      carrierCode: 'one',
    })
  })

  it('rejects refresh requests when neither the stored container nor the owning process match the requested provider', async () => {
    const enqueueSyncRequest = vi.fn()
    const updateContainerCarrier = vi.fn(async () => undefined)

    const useCase = createRefreshRestContainerUseCase({
      containerLookup: {
        findByNumbers: vi.fn(async () => ({
          containers: [
            {
              id: 'container-1',
              containerNumber: 'DRYU2434190',
              carrierCode: 'unknown',
              processId: 'process-1',
            },
          ],
        })),
      },
      processLookup: {
        findProcessById: vi.fn(async () => ({
          process: { id: 'process-1', carrier: 'unknown' },
        })),
      },
      containerCarrierMutation: {
        updateContainerCarrier,
      },
      enqueueSyncRequest: {
        enqueueSyncRequest,
      },
    })

    await expect(
      useCase({
        container: 'DRYU2434190',
        provider: 'one',
      }),
    ).rejects.toMatchObject({
      message: 'container_provider_mismatch_for_refresh:DRYU2434190:one',
      status: 409,
    })

    expect(updateContainerCarrier).not.toHaveBeenCalled()
    expect(enqueueSyncRequest).not.toHaveBeenCalled()
  })
})
