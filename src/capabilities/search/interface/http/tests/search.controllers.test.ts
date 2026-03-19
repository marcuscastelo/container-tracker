import { describe, expect, it, vi } from 'vitest'

import { createSearchFacade } from '~/capabilities/search/application/search.facade'
import { createSearchUseCase } from '~/capabilities/search/application/search.usecase'
import { createSearchController } from '~/capabilities/search/interface/http/search.controller'
import { createSearchControllers } from '~/capabilities/search/interface/http/search.controllers'
import { SearchHttpResponseSchema } from '~/capabilities/search/interface/http/search.schemas'
import type { ContainerSearchProjection } from '~/modules/container/application/container.readmodels'
import type { ProcessSearchProjection } from '~/modules/process/application/process.readmodels'
import type { TrackingSearchProjection } from '~/modules/tracking/application/projection/tracking.search.readmodel'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

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

type TypicalSearchFixture = {
  readonly processMatches: readonly ProcessSearchProjection[]
  readonly containerMatches: readonly ContainerSearchProjection[]
  readonly vesselMatches: readonly TrackingSearchProjection[]
  readonly statusMatches: readonly TrackingSearchProjection[]
}

function createTypicalSearchFixture(processCount: number): TypicalSearchFixture {
  const processMatches: ProcessSearchProjection[] = Array.from(
    { length: processCount },
    (_, index) => {
      const id = String(index).padStart(4, '0')
      return {
        processId: `process-${id}`,
        reference: `REF-${id}`,
        importerName: `Importer ${id}`,
        billOfLading: `BL-${id}`,
        carrier: index % 2 === 0 ? 'MAERSK' : 'MSC',
      }
    },
  )

  const containerMatches: ContainerSearchProjection[] = processMatches.flatMap(
    (processMatch, index) => {
      return [
        {
          processId: processMatch.processId,
          containerNumber: `MSKU${String(index).padStart(7, '0')}`,
        },
        {
          processId: processMatch.processId,
          containerNumber: `MSKU${String(index + processCount).padStart(7, '0')}`,
        },
      ]
    },
  )

  const vesselMatches: TrackingSearchProjection[] = processMatches
    .filter((_unused, index) => index % 3 === 0)
    .map((processMatch, index) => ({
      processId: processMatch.processId,
      vesselName: `MV Atlas ${index}`,
      latestDerivedStatus: 'IN_TRANSIT',
      latestEta: temporalDtoFromCanonical('2026-03-10T00:00:00.000Z'),
    }))

  const statusMatches: TrackingSearchProjection[] = processMatches
    .filter((_unused, index) => index % 5 === 0)
    .map((processMatch, index) => ({
      processId: processMatch.processId,
      vesselName: `MV Boreal ${index}`,
      latestDerivedStatus: 'ARRIVED_AT_POD',
      latestEta: temporalDtoFromCanonical('2026-03-12T00:00:00.000Z'),
    }))

  return {
    processMatches,
    containerMatches,
    vesselMatches,
    statusMatches,
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
        latestEta: temporalDtoFromCanonical('2026-03-04T00:00:00.000Z'),
      },
      {
        processId: 'process-10',
        vesselName: 'Maersk B',
        latestDerivedStatus: 'ARRIVED_AT_POD',
        latestEta: temporalDtoFromCanonical('2026-03-05T00:00:00.000Z'),
      },
    ]

    const statusMatches: TrackingSearchProjection[] = [
      {
        processId: 'process-20',
        vesselName: 'Maersk C',
        latestDerivedStatus: 'IN_TRANSIT',
        latestEta: temporalDtoFromCanonical('2026-03-06T00:00:00.000Z'),
      },
      {
        processId: 'process-21',
        vesselName: 'Maersk D',
        latestDerivedStatus: 'ARRIVED_AT_POD',
        latestEta: temporalDtoFromCanonical('2026-03-07T00:00:00.000Z'),
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

  it('keeps exact container lookup returning the owning process as top result', async () => {
    const exactContainerNumber = 'MSKU9990001'
    const { controllers } = createControllers({
      searchByText: vi.fn(async () => [
        {
          processId: 'process-legacy',
          reference: 'REF-LEGACY',
          importerName: 'Legacy Importers',
          billOfLading: 'BL-LEGACY',
          carrier: 'MAERSK',
        },
        {
          processId: 'process-noise',
          reference: 'REF-NOISE',
          importerName: 'Noise Co',
          billOfLading: 'BL-NOISE',
          carrier: 'MSC',
        },
      ]),
      searchByNumber: vi.fn(async () => [
        {
          processId: 'process-legacy',
          containerNumber: exactContainerNumber,
        },
        {
          processId: 'process-noise',
          containerNumber: `${exactContainerNumber}0`,
        },
      ]),
      searchByVesselName: vi.fn(async () => []),
      searchByDerivedStatusText: vi.fn(async () => []),
    })

    const response = await controllers.search({
      request: new Request(`http://localhost/api/search?q=${exactContainerNumber}`),
    })
    const body = SearchHttpResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body[0]?.processId).toBe('process-legacy')
    expect(body[0]?.containers).toContain(exactContainerNumber)
  })

  it('returns one consolidated process row per processId for ambiguous queries', async () => {
    const { controllers } = createControllers({
      searchByText: vi.fn(async () => [
        {
          processId: 'process-01',
          reference: 'REF-OCEAN-01',
          importerName: 'Oceanic Imports',
          billOfLading: 'BL-OCEAN-01',
          carrier: 'MAERSK',
        },
        {
          processId: 'process-02',
          reference: 'REF-OCEAN-02',
          importerName: 'Oceanic Imports',
          billOfLading: 'BL-OCEAN-02',
          carrier: 'MSC',
        },
      ]),
      searchByNumber: vi.fn(async () => [
        { processId: 'process-01', containerNumber: 'MSKU0000001' },
        { processId: 'process-01', containerNumber: 'MSKU0000001' },
        { processId: 'process-01', containerNumber: 'MSKU0000002' },
        { processId: 'process-02', containerNumber: 'MSKU0000003' },
      ]),
      searchByVesselName: vi.fn(async () => [
        {
          processId: 'process-01',
          vesselName: 'Ocean Runner',
          latestDerivedStatus: 'IN_TRANSIT',
          latestEta: temporalDtoFromCanonical('2026-03-15T00:00:00.000Z'),
        },
        {
          processId: 'process-02',
          vesselName: 'Ocean Star',
          latestDerivedStatus: 'ARRIVED_AT_POD',
          latestEta: temporalDtoFromCanonical('2026-03-18T00:00:00.000Z'),
        },
      ]),
      searchByDerivedStatusText: vi.fn(async () => [
        {
          processId: 'process-01',
          vesselName: 'Ocean Runner',
          latestDerivedStatus: 'IN_TRANSIT',
          latestEta: temporalDtoFromCanonical('2026-03-15T00:00:00.000Z'),
        },
      ]),
    })

    const response = await controllers.search({
      request: new Request('http://localhost/api/search?q=ocean'),
    })
    const body = SearchHttpResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(new Set(body.map((item) => item.processId)).size).toBe(body.length)
    expect(body.filter((item) => item.processId === 'process-01')).toHaveLength(1)
    expect(body.find((item) => item.processId === 'process-01')?.containers).toEqual([
      'MSKU0000001',
      'MSKU0000002',
    ])
  })

  it('responds below 300ms for a typical fixture query with a 30-result cap', async () => {
    const fixture = createTypicalSearchFixture(240)
    const { controllers } = createControllers({
      searchByText: vi.fn(async () => fixture.processMatches),
      searchByNumber: vi.fn(async () => fixture.containerMatches),
      searchByVesselName: vi.fn(async () => fixture.vesselMatches),
      searchByDerivedStatusText: vi.fn(async () => fixture.statusMatches),
    })

    const startedAtMs = performance.now()
    const response = await controllers.search({
      request: new Request('http://localhost/api/search?q=msku'),
    })
    const body = SearchHttpResponseSchema.parse(await response.json())
    const elapsedMs = performance.now() - startedAtMs

    expect(response.status).toBe(200)
    expect(body).toHaveLength(30)
    expect(elapsedMs).toBeLessThan(300)
  })
})
