import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearNavbarAlertsSummaryCache,
  fetchNavbarAlertsSummary,
} from '~/shared/api/navbar-alerts/navbar-alerts.api'

function mockNavbarAlertsFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          generated_at: '2026-03-13T12:00:00.000Z',
          total_active_incidents: 1,
          processes: [
            {
              process_id: 'process-1',
              process_reference: 'REF-001',
              carrier: 'MSC',
              route_summary: 'SANTOS → HAMBURG',
              active_incident_count: 1,
              affected_container_count: 1,
              dominant_severity: 'warning',
              latest_incident_at: '2026-03-12T10:00:00.000Z',
              incidents: [
                {
                  incident_key: 'ETA_PASSED:MSCU1111111',
                  type: 'ETA_PASSED',
                  category: 'eta',
                  severity: 'warning',
                  fact: {
                    message_key: 'incidents.fact.etaPassed',
                    message_params: {},
                  },
                  action: {
                    action_key: 'incidents.action.checkEta',
                    action_params: {},
                    action_kind: 'CHECK_ETA',
                  },
                  affected_container_count: 1,
                  triggered_at: '2026-03-12T10:00:00.000Z',
                  containers: [
                    {
                      container_id: 'container-1',
                      container_number: 'MSCU1111111',
                      lifecycle_state: 'ACTIVE',
                    },
                  ],
                },
              ],
            },
          ],
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

describe('fetchNavbarAlertsSummary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearNavbarAlertsSummaryCache()
  })

  it('uses cached data when preferCached is enabled', async () => {
    const fetchSpy = mockNavbarAlertsFetch()

    await fetchNavbarAlertsSummary()
    fetchSpy.mockClear()

    await fetchNavbarAlertsSummary({ preferCached: true })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('dedupes concurrent requests', async () => {
    const fetchSpy = mockNavbarAlertsFetch()

    await Promise.all([fetchNavbarAlertsSummary(), fetchNavbarAlertsSummary()])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith('/api/operational-incidents/navbar-summary', undefined)
  })
})
