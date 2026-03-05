import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchDashboardProcessSummaries } from '~/modules/process/ui/validation/processApi.validation'

function mockProcessListFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
  )
}

describe('fetchDashboardProcessSummaries', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the existing dashboard endpoint when sort params are omitted', async () => {
    const fetchSpy = mockProcessListFetch()

    await fetchDashboardProcessSummaries()

    expect(fetchSpy).toHaveBeenCalledWith('/api/processes', undefined)
  })

  it('serializes optional sort query params when both are provided', async () => {
    const fetchSpy = mockProcessListFetch()

    await fetchDashboardProcessSummaries({
      sortField: 'status',
      sortDir: 'asc',
    })

    expect(fetchSpy).toHaveBeenCalledWith('/api/processes?sortField=status&sortDir=asc', undefined)
  })

  it('ignores incomplete sort query params', async () => {
    const fetchSpy = mockProcessListFetch()

    await fetchDashboardProcessSummaries({
      sortField: 'provider',
    })
    await fetchDashboardProcessSummaries({
      sortDir: 'desc',
    })

    expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/processes', undefined)
    expect(fetchSpy).toHaveBeenNthCalledWith(2, '/api/processes', undefined)
  })

  it('serializes optional filter query params', async () => {
    const fetchSpy = mockProcessListFetch()

    await fetchDashboardProcessSummaries({
      filters: {
        provider: ['MAERSK', 'MSC'],
        status: ['IN_TRANSIT', 'DELIVERED'],
        importerId: 'importer-42',
        importerName: 'Empresa ABC',
      },
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/processes?provider=MAERSK&provider=MSC&status=IN_TRANSIT&status=DELIVERED&importerId=importer-42&importerName=Empresa+ABC',
      undefined,
    )
  })

  it('serializes sort and filters together when both are valid', async () => {
    const fetchSpy = mockProcessListFetch()

    await fetchDashboardProcessSummaries({
      sortField: 'createdAt',
      sortDir: 'desc',
      filters: {
        provider: ['MAERSK'],
        status: ['LOADED'],
      },
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/processes?sortField=createdAt&sortDir=desc&provider=MAERSK&status=LOADED',
      undefined,
    )
  })

  it('ignores empty filter values and keeps existing endpoint behavior', async () => {
    const fetchSpy = mockProcessListFetch()

    await fetchDashboardProcessSummaries({
      filters: {
        provider: ['', '   '],
        status: [],
        importerId: ' ',
        importerName: '',
      },
    })

    expect(fetchSpy).toHaveBeenCalledWith('/api/processes', undefined)
  })
})
