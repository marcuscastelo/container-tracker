import { describe, expect, it, vi } from 'vitest'
import {
  type CreateSearchUseCaseDeps,
  createSearchUseCase,
} from '~/capabilities/search/application/search.usecase'
import type { ContainerSearchProjection } from '~/modules/container/application/container.readmodels'
import type { ProcessSearchProjection } from '~/modules/process/application/process.readmodels'
import type { TrackingSearchProjection } from '~/modules/tracking/application/projection/tracking.search.readmodel'

type SearchDepsOverrides = {
  readonly processResults?: readonly ProcessSearchProjection[]
  readonly containerResults?: readonly ContainerSearchProjection[]
  readonly vesselResults?: readonly TrackingSearchProjection[]
  readonly statusResults?: readonly TrackingSearchProjection[]
}

function createDeps(overrides: SearchDepsOverrides = {}) {
  const searchByText = vi.fn(
    async (_query: string, _limit: number): Promise<readonly ProcessSearchProjection[]> =>
      overrides.processResults ?? [],
  )
  const searchByNumber = vi.fn(
    async (_query: string, _limit: number): Promise<readonly ContainerSearchProjection[]> =>
      overrides.containerResults ?? [],
  )
  const searchByVesselName = vi.fn(
    async (_query: string, _limit: number): Promise<readonly TrackingSearchProjection[]> =>
      overrides.vesselResults ?? [],
  )
  const searchByDerivedStatusText = vi.fn(
    async (_query: string, _limit: number): Promise<readonly TrackingSearchProjection[]> =>
      overrides.statusResults ?? [],
  )

  const deps: CreateSearchUseCaseDeps = {
    processUseCases: { searchByText },
    containerUseCases: { searchByNumber },
    trackingUseCases: {
      searchByVesselName,
      searchByDerivedStatusText,
    },
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
      createDeps()
    const search = createSearchUseCase(deps)

    await search({ query: '  MaErSk  ' })

    expect(searchByText).toHaveBeenCalledTimes(1)
    expect(searchByNumber).toHaveBeenCalledTimes(1)
    expect(searchByVesselName).toHaveBeenCalledTimes(1)
    expect(searchByDerivedStatusText).toHaveBeenCalledTimes(1)
    expect(searchByText).toHaveBeenCalledWith('maersk', 30)
    expect(searchByNumber).toHaveBeenCalledWith('maersk', 30)
    expect(searchByVesselName).toHaveBeenCalledWith('maersk', 30)
    expect(searchByDerivedStatusText).toHaveBeenCalledWith('maersk', 30)
  })

  it('consolidates multi-BC matches by processId and removes duplicates', async () => {
    const { deps } = createDeps({
      processResults: [
        {
          processId: 'process-1',
          reference: 'REF-001',
          importerName: 'ACME Logistics',
          billOfLading: 'BL-001',
          carrier: 'Maersk',
        },
      ],
      containerResults: [
        { processId: 'process-1', containerNumber: 'MSKU1234567' },
        { processId: 'process-1', containerNumber: 'MSKU1234567' },
        { processId: 'process-1', containerNumber: 'MSKU7654321' },
        { processId: 'process-2', containerNumber: 'MSKU0000001' },
      ],
      vesselResults: [
        {
          processId: 'process-1',
          vesselName: 'Ever Prime',
          latestDerivedStatus: 'IN_TRANSIT',
          latestEta: '2026-04-15T00:00:00.000Z',
        },
      ],
      statusResults: [
        {
          processId: 'process-2',
          vesselName: 'Ocean Wind',
          latestDerivedStatus: 'ARRIVED_AT_POD',
          latestEta: '2026-04-20T00:00:00.000Z',
        },
      ],
    })
    const search = createSearchUseCase(deps)

    const result = await search({ query: '  msku  ' })

    expect(result).toHaveLength(2)

    const processOne = result.find((item) => item.processId === 'process-1')
    expect(processOne).toEqual({
      processId: 'process-1',
      processReference: 'REF-001',
      importerName: 'ACME Logistics',
      containers: ['MSKU1234567', 'MSKU7654321'],
      carrier: 'Maersk',
      vesselName: 'Ever Prime',
      bl: 'BL-001',
      derivedStatus: 'IN_TRANSIT',
      eta: '2026-04-15T00:00:00.000Z',
      matchSource: 'container',
    })

    const processTwo = result.find((item) => item.processId === 'process-2')
    expect(processTwo).toEqual({
      processId: 'process-2',
      processReference: null,
      importerName: null,
      containers: ['MSKU0000001'],
      carrier: null,
      vesselName: 'Ocean Wind',
      bl: null,
      derivedStatus: 'ARRIVED_AT_POD',
      eta: '2026-04-20T00:00:00.000Z',
      matchSource: 'container',
    })
  })

  it('applies ranking priority by match strength levels', async () => {
    const { deps } = createDeps({
      processResults: [
        {
          processId: 'process-exact-reference',
          reference: 'MATCH-KEY',
          importerName: null,
          billOfLading: null,
          carrier: null,
        },
        {
          processId: 'process-importer',
          reference: 'REF-003',
          importerName: 'Match-key Importers',
          billOfLading: null,
          carrier: null,
        },
      ],
      containerResults: [
        { processId: 'process-exact-container', containerNumber: 'MATCH-KEY' },
        { processId: 'process-partial-container', containerNumber: 'MSKU-MATCH-KEY-001' },
      ],
      vesselResults: [
        {
          processId: 'process-vessel',
          vesselName: 'MV Match-key',
          latestDerivedStatus: 'IN_TRANSIT',
          latestEta: '2026-05-01T00:00:00.000Z',
        },
      ],
      statusResults: [
        {
          processId: 'process-status',
          vesselName: 'MV Ocean',
          latestDerivedStatus: 'IN_TRANSIT',
          latestEta: null,
        },
      ],
    })
    const search = createSearchUseCase(deps)

    const result = await search({ query: 'match-key' })

    expect(result.map((item) => item.processId)).toEqual([
      'process-exact-container',
      'process-exact-reference',
      'process-partial-container',
      'process-importer',
      'process-vessel',
      'process-status',
    ])
  })

  it('uses deterministic tie-breaker by processReference then processId', async () => {
    const { deps } = createDeps({
      processResults: [
        {
          processId: 'process-z',
          reference: 'REF-002',
          importerName: 'Market Imports',
          billOfLading: null,
          carrier: null,
        },
        {
          processId: 'process-b',
          reference: 'REF-001',
          importerName: 'Market Imports',
          billOfLading: null,
          carrier: null,
        },
        {
          processId: 'process-a',
          reference: 'REF-001',
          importerName: 'Market Imports',
          billOfLading: null,
          carrier: null,
        },
      ],
    })
    const search = createSearchUseCase(deps)

    const result = await search({ query: 'market' })

    expect(result.map((item) => item.processId)).toEqual(['process-a', 'process-b', 'process-z'])
  })

  it('applies fixed limit of 30 items after consolidation', async () => {
    const containerResults = Array.from({ length: 35 }, (_unused, index) => ({
      processId: `process-${index + 1}`,
      containerNumber: `MSKU${String(index + 1).padStart(7, '0')}`,
    }))
    const { deps } = createDeps({ containerResults })
    const search = createSearchUseCase(deps)

    const result = await search({ query: 'msk' })

    expect(result).toHaveLength(30)
    expect(new Set(result.map((item) => item.processId)).size).toBe(30)
  })
})
