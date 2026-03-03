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
})
