import { describe, expect, it } from 'vitest'
import type { NavbarAlertsSummaryReadModel } from '~/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel'
import { createDashboardControllersHarness } from '~/capabilities/dashboard/interface/http/tests/dashboard.controllers.test.helpers'
import { NavbarAlertsSummaryResponseSchema } from '~/shared/api-schemas/dashboard.schemas'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

describe('dashboard controllers - navbar message contract behavior', () => {
  function createNavbarSummaryRequest(): Request {
    return new Request('http://localhost/api/alerts/navbar-summary')
  }

  it('returns navbar alerts summary grouped by process and container', async () => {
    const navbarSummary: NavbarAlertsSummaryReadModel = {
      totalActiveAlerts: 2,
      processes: [
        {
          processId: 'process-1',
          processReference: 'REF-001',
          carrier: 'MSC',
          routeSummary: 'SANTOS → HAMBURG',
          activeAlertsCount: 2,
          dominantSeverity: 'danger',
          latestAlertAt: '2026-03-11T10:00:00.000Z',
          containers: [
            {
              containerId: 'container-1',
              containerNumber: 'MSCU1111111',
              status: 'IN_TRANSIT',
              eta: temporalDtoFromCanonical('2026-03-21T00:00:00.000Z'),
              activeAlertsCount: 2,
              dominantSeverity: 'danger',
              latestAlertAt: '2026-03-11T10:00:00.000Z',
              alerts: [
                {
                  alertId: 'alert-1',
                  severity: 'danger',
                  category: 'monitoring',
                  messageKey: 'alerts.noMovementDetected',
                  messageParams: {
                    threshold_days: 10,
                    days_without_movement: 11,
                    days: 11,
                    lastEventDate: '2026-02-28',
                  },
                  occurredAt: '2026-03-11T10:00:00.000Z',
                  retroactive: false,
                },
                {
                  alertId: 'alert-2',
                  severity: 'warning',
                  category: 'fact',
                  messageKey: 'alerts.customsHoldDetected',
                  messageParams: { location: 'HAMBURG' },
                  occurredAt: '2026-03-10T10:00:00.000Z',
                  retroactive: true,
                },
              ],
            },
          ],
        },
      ],
    }

    const { controllers } = createDashboardControllersHarness({
      getNavbarAlertsSummaryReadModel: async () => navbarSummary,
    })

    const response = await controllers.getNavbarAlertsSummary({
      request: createNavbarSummaryRequest(),
    })
    const body = NavbarAlertsSummaryResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.total_active_alerts).toBe(2)
    expect(body.processes).toHaveLength(1)
    expect(body.processes[0]?.process_id).toBe('process-1')
    expect(body.processes[0]?.containers[0]?.alerts[0]?.message_key).toBe(
      'alerts.noMovementDetected',
    )
  })
})
