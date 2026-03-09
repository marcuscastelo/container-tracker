import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearPrefetchedProcessDetails, fetchProcess } from '~/modules/process/ui/fetchProcess'

type BuildProcessDetailResponseCommand = {
  readonly ackedAt: string | null
}

const PROCESS_ID = 'process-ack-race'
const CONTAINER_ID = 'container-ack-race'
const CONTAINER_NUMBER = 'MSCU1234567'
const TRIGGERED_AT_ISO = '2026-03-08T12:00:00.000Z'

function buildProcessDetailResponse(
  command: BuildProcessDetailResponseCommand,
): Record<string, unknown> {
  return {
    id: PROCESS_ID,
    reference: 'REF-ACK-RACE',
    origin: { display_name: 'Shanghai' },
    destination: { display_name: 'Santos' },
    carrier: 'msc',
    bill_of_lading: null,
    booking_number: null,
    importer_name: null,
    exporter_name: null,
    reference_importer: null,
    product: null,
    redestination_number: null,
    importer_id: null,
    source: 'api',
    created_at: '2026-03-08T10:00:00.000Z',
    updated_at: '2026-03-08T10:00:00.000Z',
    containers: [
      {
        id: CONTAINER_ID,
        container_number: CONTAINER_NUMBER,
        carrier_code: 'MSC',
        status: 'IN_TRANSIT',
        observations: [],
        timeline: [],
        operational: {
          status: 'IN_TRANSIT',
          eta: null,
          transshipment: {
            has_transshipment: false,
            count: 0,
            ports: [],
          },
          data_issue: false,
        },
      },
    ],
    alerts: [
      {
        id: 'alert-ack-race',
        container_number: CONTAINER_NUMBER,
        category: 'monitoring',
        type: 'ETA_MISSING',
        severity: 'warning',
        message_key: 'alerts.etaMissing',
        message_params: {},
        detected_at: TRIGGERED_AT_ISO,
        triggered_at: TRIGGERED_AT_ISO,
        retroactive: false,
        provider: 'msc',
        acked_at: command.ackedAt,
      },
    ],
    process_operational: {
      derived_status: 'IN_TRANSIT',
      eta_max: null,
      coverage: {
        total: 1,
        with_eta: 0,
      },
    },
    containersSync: [
      {
        containerNumber: CONTAINER_NUMBER,
        carrier: 'MSC',
        lastSuccessAt: null,
        lastAttemptAt: null,
        isSyncing: false,
        lastErrorCode: null,
        lastErrorAt: null,
      },
    ],
  }
}

function toJsonResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchProcess cache behavior', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearPrefetchedProcessDetails()
  })

  it('returns cached process data in cache-first mode', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(toJsonResponse(buildProcessDetailResponse({ ackedAt: null })))
      .mockResolvedValueOnce(
        toJsonResponse(buildProcessDetailResponse({ ackedAt: '2026-03-08T12:30:00.000Z' })),
      )

    const first = await fetchProcess(PROCESS_ID, 'en-US')
    const second = await fetchProcess(PROCESS_ID, 'en-US')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(first?.alerts[0]?.ackedAtIso).toBeNull()
    expect(second?.alerts[0]?.ackedAtIso).toBeNull()
  })

  it('bypasses cache and refreshes canonical snapshot in network-only mode', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(toJsonResponse(buildProcessDetailResponse({ ackedAt: null })))
      .mockResolvedValueOnce(
        toJsonResponse(buildProcessDetailResponse({ ackedAt: '2026-03-08T12:30:00.000Z' })),
      )

    const stale = await fetchProcess(PROCESS_ID, 'en-US')
    const refreshed = await fetchProcess(PROCESS_ID, 'en-US', { mode: 'network-only' })
    const fromUpdatedCache = await fetchProcess(PROCESS_ID, 'en-US')

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(stale?.alerts[0]?.ackedAtIso).toBeNull()
    expect(refreshed?.alerts[0]?.ackedAtIso).toBe('2026-03-08T12:30:00.000Z')
    expect(fromUpdatedCache?.alerts[0]?.ackedAtIso).toBe('2026-03-08T12:30:00.000Z')
  })
})
