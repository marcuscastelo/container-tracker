import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearPrefetchedProcessDetailById,
  clearPrefetchedProcessDetails,
  fetchProcess,
} from '~/modules/process/ui/fetchProcess'

type BuildProcessDetailResponseCommand = {
  readonly processId: string
  readonly containerId: string
  readonly containerNumber: string
  readonly reference: string
  readonly ackedAt: string | null
}

const TRIGGERED_AT_ISO = '2026-03-08T12:00:00.000Z'

function buildProcessDetailResponse(
  command: BuildProcessDetailResponseCommand,
): Record<string, unknown> {
  return {
    id: command.processId,
    tracking_freshness_token: `freshness-${command.processId}-${command.ackedAt ?? 'active'}`,
    reference: command.reference,
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
        id: command.containerId,
        container_number: command.containerNumber,
        carrier_code: 'MSC',
        status: 'IN_TRANSIT',
        tracking_validation: {
          has_issues: false,
          highest_severity: null,
          finding_count: 0,
        },
        timeline: [],
        operational: {
          status: 'IN_TRANSIT',
          eta: null,
          transshipment: {
            has_transshipment: false,
            count: 0,
            ports: [],
          },
          current_context: {
            location_code: null,
            location_display: null,
            vessel_name: null,
            voyage: null,
            vessel_visible: true,
          },
          next_location: null,
          data_issue: false,
        },
      },
    ],
    tracking_validation: {
      has_issues: false,
      highest_severity: null,
      affected_container_count: 0,
    },
    alerts: [
      {
        id: `alert-${command.processId}`,
        container_number: command.containerNumber,
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
        containerNumber: command.containerNumber,
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
      .mockResolvedValueOnce(
        toJsonResponse(
          buildProcessDetailResponse({
            processId: 'process-cache',
            containerId: 'container-cache',
            containerNumber: 'MSCU1234567',
            reference: 'REF-CACHE',
            ackedAt: null,
          }),
        ),
      )
      .mockResolvedValueOnce(
        toJsonResponse(
          buildProcessDetailResponse({
            processId: 'process-cache',
            containerId: 'container-cache',
            containerNumber: 'MSCU1234567',
            reference: 'REF-CACHE',
            ackedAt: '2026-03-08T12:30:00.000Z',
          }),
        ),
      )

    const first = await fetchProcess('process-cache', 'en-US')
    const second = await fetchProcess('process-cache', 'en-US')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(first?.alerts[0]?.ackedAtIso).toBeNull()
    expect(second?.alerts[0]?.ackedAtIso).toBeNull()
  })

  it('bypasses cache and refreshes canonical snapshot in network-only mode', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        toJsonResponse(
          buildProcessDetailResponse({
            processId: 'process-network',
            containerId: 'container-network',
            containerNumber: 'MSCU7654321',
            reference: 'REF-NETWORK',
            ackedAt: null,
          }),
        ),
      )
      .mockResolvedValueOnce(
        toJsonResponse(
          buildProcessDetailResponse({
            processId: 'process-network',
            containerId: 'container-network',
            containerNumber: 'MSCU7654321',
            reference: 'REF-NETWORK',
            ackedAt: '2026-03-08T12:30:00.000Z',
          }),
        ),
      )

    const stale = await fetchProcess('process-network', 'en-US')
    const refreshed = await fetchProcess('process-network', 'en-US', { mode: 'network-only' })
    const fromUpdatedCache = await fetchProcess('process-network', 'en-US')

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(stale?.alerts[0]?.ackedAtIso).toBeNull()
    expect(refreshed?.alerts[0]?.ackedAtIso).toBe('2026-03-08T12:30:00.000Z')
    expect(fromUpdatedCache?.alerts[0]?.ackedAtIso).toBe('2026-03-08T12:30:00.000Z')
  })

  it('invalidates only the targeted process cache entries by processId', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        toJsonResponse(
          buildProcessDetailResponse({
            processId: 'process-a',
            containerId: 'container-a',
            containerNumber: 'MSCU1111111',
            reference: 'REF-A',
            ackedAt: null,
          }),
        ),
      )
      .mockResolvedValueOnce(
        toJsonResponse(
          buildProcessDetailResponse({
            processId: 'process-b',
            containerId: 'container-b',
            containerNumber: 'MSCU2222222',
            reference: 'REF-B',
            ackedAt: null,
          }),
        ),
      )
      .mockResolvedValueOnce(
        toJsonResponse(
          buildProcessDetailResponse({
            processId: 'process-a',
            containerId: 'container-a',
            containerNumber: 'MSCU1111111',
            reference: 'REF-A',
            ackedAt: '2026-03-08T12:40:00.000Z',
          }),
        ),
      )

    const firstA = await fetchProcess('process-a', 'en-US')
    const firstB = await fetchProcess('process-b', 'en-US')
    clearPrefetchedProcessDetailById('process-a')
    const refreshedA = await fetchProcess('process-a', 'en-US')
    const cachedB = await fetchProcess('process-b', 'en-US')

    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(firstA?.alerts[0]?.ackedAtIso).toBeNull()
    expect(firstB?.alerts[0]?.ackedAtIso).toBeNull()
    expect(refreshedA?.alerts[0]?.ackedAtIso).toBe('2026-03-08T12:40:00.000Z')
    expect(cachedB?.alerts[0]?.ackedAtIso).toBeNull()
  })
})
