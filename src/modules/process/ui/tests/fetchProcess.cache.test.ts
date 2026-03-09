import { beforeEach, describe, expect, it, vi } from 'vitest'

const processFetchMocks = vi.hoisted(() => ({
  typedFetch: vi.fn(),
  toShipmentDetailVM: vi.fn(),
}))

vi.mock('~/shared/api/typedFetch', () => ({
  typedFetch: processFetchMocks.typedFetch,
  TypedFetchError: class TypedFetchError extends Error {
    readonly status: number

    constructor(status: number, message?: string) {
      super(message ?? `status ${status}`)
      this.status = status
    }
  },
}))

vi.mock('~/modules/process/ui/mappers/processDetail.ui-mapper', () => ({
  toShipmentDetailVM: processFetchMocks.toShipmentDetailVM,
}))

import {
  clearPrefetchedProcessDetailById,
  clearPrefetchedProcessDetails,
  fetchProcess,
} from '~/modules/process/ui/fetchProcess'

describe('fetchProcess cache', () => {
  beforeEach(() => {
    clearPrefetchedProcessDetails()
    processFetchMocks.typedFetch.mockReset()
    processFetchMocks.toShipmentDetailVM.mockReset()
    processFetchMocks.toShipmentDetailVM.mockImplementation((data: unknown) => data)
  })

  it('reuses cached process detail by default for the same process and locale', async () => {
    processFetchMocks.typedFetch.mockResolvedValue({ id: 'process-1', request: 1 })

    await fetchProcess('process-1', 'pt-BR')
    await fetchProcess('process-1', 'pt-BR')

    expect(processFetchMocks.typedFetch).toHaveBeenCalledTimes(1)
  })

  it('can bypass cache for manual refetch scenarios', async () => {
    processFetchMocks.typedFetch.mockResolvedValue({ id: 'process-1', request: 1 })

    await fetchProcess('process-1', 'pt-BR')
    await fetchProcess('process-1', 'pt-BR', { preferCached: false })

    expect(processFetchMocks.typedFetch).toHaveBeenCalledTimes(2)
  })

  it('invalidates only the targeted process cache entries by processId', async () => {
    processFetchMocks.typedFetch.mockResolvedValue({ id: 'process-1' })

    await fetchProcess('process-1', 'en-US')
    await fetchProcess('process-2', 'en-US')

    clearPrefetchedProcessDetailById('process-1')

    await fetchProcess('process-1', 'en-US')
    await fetchProcess('process-2', 'en-US')

    expect(processFetchMocks.typedFetch).toHaveBeenCalledTimes(3)
  })
})
