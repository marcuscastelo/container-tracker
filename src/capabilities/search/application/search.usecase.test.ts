import { describe, expect, it, vi } from 'vitest'
import {
  type CreateSearchUseCaseDeps,
  createSearchUseCase,
} from '~/capabilities/search/application/search.usecase'
import type { ContainerSearchProjection } from '~/modules/container/application/container.readmodels'
import type { ProcessSearchProjection } from '~/modules/process/application/process.readmodels'
import type { TrackingSearchProjection } from '~/modules/tracking/application/projection/tracking.search.readmodel'

function createDeps(limit?: number) {
  const searchByText = vi.fn(
    async (_query: string, _limit: number): Promise<readonly ProcessSearchProjection[]> => [],
  )
  const searchByNumber = vi.fn(
    async (_query: string, _limit: number): Promise<readonly ContainerSearchProjection[]> => [],
  )
  const searchByVesselName = vi.fn(
    async (_query: string, _limit: number): Promise<readonly TrackingSearchProjection[]> => [],
  )
  const searchByDerivedStatusText = vi.fn(
    async (_query: string, _limit: number): Promise<readonly TrackingSearchProjection[]> => [],
  )

  const deps: CreateSearchUseCaseDeps = {
    processUseCases: { searchByText },
    containerUseCases: { searchByNumber },
    trackingUseCases: {
      searchByVesselName,
      searchByDerivedStatusText,
    },
    limit,
  }

  return {
    deps,
    searchByText,
    searchByNumber,
    searchByVesselName,
    searchByDerivedStatusText,
  }
}

describe('createSearchUseCase', () => {
  it('returns empty results for empty query and does not call BC search use cases', async () => {
    const { deps, searchByText, searchByNumber, searchByVesselName, searchByDerivedStatusText } =
      createDeps()
    const search = createSearchUseCase(deps)

    const result = await search({ query: '   ' })

    expect(result).toEqual([])
    expect(searchByText).not.toHaveBeenCalled()
    expect(searchByNumber).not.toHaveBeenCalled()
    expect(searchByVesselName).not.toHaveBeenCalled()
    expect(searchByDerivedStatusText).not.toHaveBeenCalled()
  })

  it('returns empty results for one or two characters and does not call BC search use cases', async () => {
    const { deps, searchByText, searchByNumber, searchByVesselName, searchByDerivedStatusText } =
      createDeps()
    const search = createSearchUseCase(deps)

    const oneCharResult = await search({ query: ' a ' })
    const twoCharResult = await search({ query: ' AB ' })

    expect(oneCharResult).toEqual([])
    expect(twoCharResult).toEqual([])
    expect(searchByText).not.toHaveBeenCalled()
    expect(searchByNumber).not.toHaveBeenCalled()
    expect(searchByVesselName).not.toHaveBeenCalled()
    expect(searchByDerivedStatusText).not.toHaveBeenCalled()
  })

  it('normalizes query with trim + lowercase before calling BC search use cases', async () => {
    const { deps, searchByText, searchByNumber, searchByVesselName, searchByDerivedStatusText } =
      createDeps(12)
    const search = createSearchUseCase(deps)

    await search({ query: '  MaErSk  ' })

    expect(searchByText).toHaveBeenCalledTimes(1)
    expect(searchByNumber).toHaveBeenCalledTimes(1)
    expect(searchByVesselName).toHaveBeenCalledTimes(1)
    expect(searchByDerivedStatusText).toHaveBeenCalledTimes(1)
    expect(searchByText).toHaveBeenCalledWith('maersk', 12)
    expect(searchByNumber).toHaveBeenCalledWith('maersk', 12)
    expect(searchByVesselName).toHaveBeenCalledWith('maersk', 12)
    expect(searchByDerivedStatusText).toHaveBeenCalledWith('maersk', 12)
  })
})
