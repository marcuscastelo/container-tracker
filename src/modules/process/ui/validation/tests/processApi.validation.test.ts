import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acknowledgeTrackingAlertRequest,
  fetchDashboardProcessSummaries,
  unacknowledgeTrackingAlertRequest,
} from '~/modules/process/ui/validation/processApi.validation'

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

describe('tracking alert action requests', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends acknowledge action with the expected payload', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true, alert_id: 'alert-1', action: 'acknowledge' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    await acknowledgeTrackingAlertRequest('alert-1')

    expect(fetchSpy).toHaveBeenCalledWith('/api/alerts', {
      method: 'PATCH',
      body: JSON.stringify({ alert_id: 'alert-1', action: 'acknowledge' }),
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('sends unacknowledge action with the expected payload', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true, alert_id: 'alert-2', action: 'unacknowledge' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    await unacknowledgeTrackingAlertRequest('alert-2')

    expect(fetchSpy).toHaveBeenCalledWith('/api/alerts', {
      method: 'PATCH',
      body: JSON.stringify({ alert_id: 'alert-2', action: 'unacknowledge' }),
      headers: { 'Content-Type': 'application/json' },
    })
  })
})
