import { describe, expect, it, vi } from 'vitest'

import { createSearchFacade } from '~/capabilities/search/application/search.facade'
import { createSearchUseCase } from '~/capabilities/search/application/search.usecase'
import { createSearchController } from '~/capabilities/search/interface/http/search.controller'
import { createSearchControllers } from '~/capabilities/search/interface/http/search.controllers'
import { SearchHttpResponseSchema } from '~/capabilities/search/interface/http/search.schemas'
import type { ContainerSearchProjection } from '~/modules/container/application/container.readmodels'
import type { ProcessSearchProjection } from '~/modules/process/application/process.readmodels'
import type { TrackingSearchProjection } from '~/modules/tracking/application/projection/tracking.search.readmodel'

type SearchDeps = {
  readonly searchByText: ReturnType<
    typeof vi.fn<(query: string, limit: number) => Promise<readonly ProcessSearchProjection[]>>
  >
  readonly searchByNumber: ReturnType<
    typeof vi.fn<(query: string, limit: number) => Promise<readonly ContainerSearchProjection[]>>
  >
  readonly searchByVesselName: ReturnType<
    typeof vi.fn<(query: string, limit: number) => Promise<readonly TrackingSearchProjection[]>>
  >
  readonly searchByDerivedStatusText: ReturnType<
    typeof vi.fn<(query: string, limit: number) => Promise<readonly TrackingSearchProjection[]>>
  >
}

function createControllers(deps?: Partial<SearchDeps>) {
  const searchByText =
    deps?.searchByText ??
    vi.fn(async () => {
      return []
    })
  const searchByNumber =
    deps?.searchByNumber ??
    vi.fn(async () => {
      return []
    })
  const searchByVesselName =
    deps?.searchByVesselName ??
    vi.fn(async () => {
      return []
    })
  const searchByDerivedStatusText =
    deps?.searchByDerivedStatusText ??
    vi.fn(async () => {
      return []
    })

  const searchUseCase = createSearchUseCase({
    processUseCases: { searchByText },
    containerUseCases: { searchByNumber },
    trackingUseCases: { searchByVesselName, searchByDerivedStatusText },
  })
  const searchFacade = createSearchFacade({ searchUseCase })
  const searchController = createSearchController({ searchFacade })
  const controllers = createSearchControllers({ searchController })

  return {
    controllers,
    deps: {
      searchByText,
      searchByNumber,
      searchByVesselName,
      searchByDerivedStatusText,
    },
  }
}

describe('search controllers', () => {
  it('returns 200 with empty list for empty or short queries without calling BC searches', async () => {
    const { controllers, deps } = createControllers()

    const emptyRequest = new Request('http://localhost/api/search')
    const shortRequest = new Request('http://localhost/api/search?q=ab')

    const emptyResponse = await controllers.search({ request: emptyRequest })
    const shortResponse = await controllers.search({ request: shortRequest })

    const emptyBody = SearchHttpResponseSchema.parse(await emptyResponse.json())
    const shortBody = SearchHttpResponseSchema.parse(await shortResponse.json())

    expect(emptyResponse.status).toBe(200)
    expect(shortResponse.status).toBe(200)
    expect(emptyBody).toEqual([])
    expect(shortBody).toEqual([])
    expect(deps.searchByText).not.toHaveBeenCalled()
    expect(deps.searchByNumber).not.toHaveBeenCalled()
    expect(deps.searchByVesselName).not.toHaveBeenCalled()
    expect(deps.searchByDerivedStatusText).not.toHaveBeenCalled()
  })

  it('caps endpoint response at 30 and removes duplicated processId across BC matches', async () => {
    const processMatches: ProcessSearchProjection[] = Array.from({ length: 35 }, (_, index) => {
      const id = String(index).padStart(2, '0')
      return {
        processId: `process-${id}`,
        reference: `REF-${id}`,
        importerName: `Importer ${id}`,
        billOfLading: `BL-${id}`,
        carrier: 'MAERSK',
      }
    })

    const containerMatches: ContainerSearchProjection[] = [
      { processId: 'process-00', containerNumber: 'MSKU0000000' },
      { processId: 'process-00', containerNumber: 'MSKU0000001' },
      { processId: 'process-10', containerNumber: 'MSKU0000010' },
      { processId: 'process-20', containerNumber: 'MSKU0000020' },
    ]

    const vesselMatches: TrackingSearchProjection[] = [
      {
        processId: 'process-00',
        vesselName: 'Maersk A',
        latestDerivedStatus: 'IN_TRANSIT',
        latestEta: '2026-03-04T00:00:00.000Z',
      },
      {
        processId: 'process-10',
        vesselName: 'Maersk B',
        latestDerivedStatus: 'ARRIVED_AT_POD',
        latestEta: '2026-03-05T00:00:00.000Z',
      },
    ]

    const statusMatches: TrackingSearchProjection[] = [
      {
        processId: 'process-20',
        vesselName: 'Maersk C',
        latestDerivedStatus: 'IN_TRANSIT',
        latestEta: '2026-03-06T00:00:00.000Z',
      },
      {
        processId: 'process-21',
        vesselName: 'Maersk D',
        latestDerivedStatus: 'ARRIVED_AT_POD',
        latestEta: '2026-03-07T00:00:00.000Z',
      },
    ]

    const { controllers, deps } = createControllers({
      searchByText: vi.fn(async () => processMatches),
      searchByNumber: vi.fn(async () => containerMatches),
      searchByVesselName: vi.fn(async () => vesselMatches),
      searchByDerivedStatusText: vi.fn(async () => statusMatches),
    })

    const response = await controllers.search({
      request: new Request('http://localhost/api/search?q=  Ref  '),
    })

    const body = SearchHttpResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body).toHaveLength(30)
    expect(new Set(body.map((item) => item.processId)).size).toBe(body.length)
    expect(deps.searchByText).toHaveBeenCalledWith('ref', 30)
    expect(deps.searchByNumber).toHaveBeenCalledWith('ref', 30)
    expect(deps.searchByVesselName).toHaveBeenCalledWith('ref', 30)
    expect(deps.searchByDerivedStatusText).toHaveBeenCalledWith('ref', 30)
  })
})
