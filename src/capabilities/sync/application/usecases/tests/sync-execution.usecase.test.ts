import { describe, expect, it } from 'vitest'
import { isContainerNotFoundLikeStatus } from '~/capabilities/sync/application/usecases/sync-execution'

describe('sync-execution detection gating', () => {
  it('accepts NOT_FOUND terminal status as detection-eligible', () => {
    expect(
      isContainerNotFoundLikeStatus({
        syncRequestId: 'sync-1',
        status: 'NOT_FOUND',
        lastError: null,
        updatedAt: null,
        refValue: 'MSCU1234567',
      }),
    ).toBe(true)
  })

  it('accepts explicit container_not_found errors as detection-eligible', () => {
    expect(
      isContainerNotFoundLikeStatus({
        syncRequestId: 'sync-1',
        status: 'FAILED',
        lastError: 'container_not_found',
        updatedAt: null,
        refValue: 'MSCU1234567',
      }),
    ).toBe(true)

    expect(
      isContainerNotFoundLikeStatus({
        syncRequestId: 'sync-1',
        status: 'FAILED',
        lastError: 'No container found for msc:MSCU1234567',
        updatedAt: null,
        refValue: 'MSCU1234567',
      }),
    ).toBe(true)
  })

  it('rejects operational failures as non-detection-eligible', () => {
    expect(
      isContainerNotFoundLikeStatus({
        syncRequestId: 'sync-1',
        status: 'FAILED',
        lastError: 'provider_unavailable',
        updatedAt: null,
        refValue: 'MSCU1234567',
      }),
    ).toBe(false)

    expect(
      isContainerNotFoundLikeStatus({
        syncRequestId: 'sync-1',
        status: 'FAILED',
        lastError: 'sync_request_not_found',
        updatedAt: null,
        refValue: 'MSCU1234567',
      }),
    ).toBe(false)

    expect(
      isContainerNotFoundLikeStatus({
        syncRequestId: 'sync-1',
        status: 'FAILED',
        lastError: 'timeout',
        updatedAt: null,
        refValue: 'MSCU1234567',
      }),
    ).toBe(false)
  })
})
