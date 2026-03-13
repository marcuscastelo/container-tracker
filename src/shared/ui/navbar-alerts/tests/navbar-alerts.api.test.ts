import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearNavbarAlertsSummaryCache,
  fetchNavbarAlertsSummary,
} from '~/shared/ui/navbar-alerts/navbar-alerts.api'

function mockNavbarAlertsFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          generated_at: '2026-03-13T12:00:00.000Z',
          total_active_alerts: 1,
          processes: [
            {
              process_id: 'process-1',
              process_reference: 'REF-001',
              carrier: 'MSC',
              route_summary: 'SANTOS → HAMBURG',
              active_alerts_count: 1,
              dominant_severity: 'warning',
              latest_alert_at: '2026-03-12T10:00:00.000Z',
              containers: [
                {
                  container_id: 'container-1',
                  container_number: 'MSCU1111111',
                  status: 'IN_TRANSIT',
                  eta: '2026-03-21T00:00:00.000Z',
                  active_alerts_count: 1,
                  dominant_severity: 'warning',
                  latest_alert_at: '2026-03-12T10:00:00.000Z',
                  alerts: [
                    {
                      alert_id: 'alert-1',
                      severity: 'warning',
                      category: 'monitoring',
                      message_key: 'alerts.noMovementDetected',
                      message_params: {
                        threshold_days: 10,
                        days_without_movement: 11,
                        days: 11,
                        lastEventDate: '2026-02-28',
                      },
                      occurred_at: '2026-03-12T10:00:00.000Z',
                      retroactive: false,
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
    expect(fetchSpy).toHaveBeenCalledWith('/api/alerts/navbar-summary', undefined)
  })
})
