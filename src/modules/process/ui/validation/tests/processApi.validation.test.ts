import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acknowledgeTrackingAlertRequest,
  clearDashboardPrefetchCache,
  deleteProcessRequest,
  fetchDashboardGlobalAlertsSummary,
  fetchDashboardProcessSummaries,
  prefetchDashboardGlobalAlertsSummary,
  prefetchDashboardProcessSummaries,
  unacknowledgeTrackingAlertRequest,
} from '~/modules/process/ui/api/process.api'
import { toCreateProcessInput } from '~/modules/process/ui/validation/processApi.validation'

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

function mockDashboardOperationalSummaryFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          generated_at: '2026-01-15T10:00:00.000Z',
          total_active_alerts: 0,
          by_severity: {
            danger: 0,
            warning: 0,
            info: 0,
            success: 0,
          },
          by_category: {
            eta: 0,
            movement: 0,
            customs: 0,
            status: 0,
            data: 0,
          },
          process_exceptions: [],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
  )
}

describe('toCreateProcessInput', () => {
  it('maps process form data into API payload with containers', () => {
    const payload = toCreateProcessInput({
      reference: 'REF-1001',
      origin: 'Shanghai',
      destination: 'Santos',
      containers: [
        { id: '1', containerNumber: 'MSCU1234567' },
        { id: '2', containerNumber: 'MSCU7654321' },
      ],
      carrier: 'msc',
      billOfLading: 'BL-123',
      bookingNumber: 'BOOK-321',
      importerName: 'Importer Co',
      exporterName: 'Exporter Co',
      referenceImporter: 'IMP-REF',
      product: 'Coffee',
      redestinationNumber: 'RD-9',
    })

    expect(payload).toEqual({
      reference: 'REF-1001',
      origin: { display_name: 'Shanghai' },
      destination: { display_name: 'Santos' },
      carrier: 'msc',
      bill_of_lading: 'BL-123',
      booking_number: 'BOOK-321',
      importer_name: 'Importer Co',
      exporter_name: 'Exporter Co',
      reference_importer: 'IMP-REF',
      product: 'Coffee',
      redestination_number: 'RD-9',
      containers: [
        { container_number: 'MSCU1234567', carrier_code: 'msc' },
        { container_number: 'MSCU7654321', carrier_code: 'msc' },
      ],
    })
  })

  it('sends nullable fields as null when user clears the form values', () => {
    const payload = toCreateProcessInput({
      reference: '',
      origin: '',
      destination: '',
      containers: [{ id: '1', containerNumber: 'MSCU1234567' }],
      carrier: 'msc',
      billOfLading: '',
      bookingNumber: '',
      importerName: '',
      exporterName: '',
      referenceImporter: '',
      product: '',
      redestinationNumber: '',
    })

    expect(payload.bill_of_lading).toBeNull()
    expect(payload.booking_number).toBeNull()
    expect(payload.importer_name).toBeNull()
    expect(payload.exporter_name).toBeNull()
    expect(payload.reference_importer).toBeNull()
    expect(payload.product).toBeNull()
    expect(payload.redestination_number).toBeNull()
  })

  it('keeps process carrier as unknown while seeding containers without carrier for auto detection', () => {
    const payload = toCreateProcessInput({
      reference: 'REF-AUTO',
      origin: 'Shanghai',
      destination: 'Santos',
      containers: [{ id: '1', containerNumber: 'CMAU1945069' }],
      carrier: 'unknown',
      billOfLading: '',
      bookingNumber: '',
      importerName: '',
      exporterName: '',
      referenceImporter: '',
      product: '',
      redestinationNumber: '',
    })

    expect(payload.carrier).toBe('unknown')
    expect(payload.containers).toEqual([
      {
        container_number: 'CMAU1945069',
        carrier_code: null,
      },
    ])
  })
})

describe('fetchDashboardProcessSummaries', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearDashboardPrefetchCache()
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

  it('uses prefetched process summaries when preferPrefetched is enabled', async () => {
    const fetchSpy = mockProcessListFetch()

    await prefetchDashboardProcessSummaries()
    fetchSpy.mockClear()

    await fetchDashboardProcessSummaries(undefined, { preferPrefetched: true })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('dedupes concurrent process summaries prefetch calls', async () => {
    const fetchSpy = mockProcessListFetch()

    await Promise.all([prefetchDashboardProcessSummaries(), prefetchDashboardProcessSummaries()])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe('fetchDashboardGlobalAlertsSummary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearDashboardPrefetchCache()
  })

  it('uses prefetched global alerts summary when preferPrefetched is enabled', async () => {
    const fetchSpy = mockDashboardOperationalSummaryFetch()

    await prefetchDashboardGlobalAlertsSummary()
    fetchSpy.mockClear()

    await fetchDashboardGlobalAlertsSummary({ preferPrefetched: true })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('dedupes concurrent global alerts summary prefetch calls', async () => {
    const fetchSpy = mockDashboardOperationalSummaryFetch()

    await Promise.all([
      prefetchDashboardGlobalAlertsSummary(),
      prefetchDashboardGlobalAlertsSummary(),
    ])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith('/api/dashboard/operational-summary', undefined)
  })
})

describe('deleteProcessRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearDashboardPrefetchCache()
  })

  it('sends DELETE /api/processes/:id and resolves on 204', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(null, {
          status: 204,
        }),
    )

    await deleteProcessRequest('process-1')

    expect(fetchSpy).toHaveBeenCalledWith('/api/processes/process-1', { method: 'DELETE' })
  })

  it('throws API error message when delete fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: 'Process not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    await expect(deleteProcessRequest('missing-process')).rejects.toThrow('Process not found')
  })
})

describe('tracking alert action requests', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearDashboardPrefetchCache()
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
