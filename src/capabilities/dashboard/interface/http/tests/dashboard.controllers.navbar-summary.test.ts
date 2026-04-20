import { describe, expect, it } from 'vitest'
import type { NavbarAlertsSummaryReadModel } from '~/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel'
import { createDashboardControllersHarness } from '~/capabilities/dashboard/interface/http/tests/dashboard.controllers.test.helpers'
import { NavbarAlertsSummaryResponseSchema } from '~/shared/api-schemas/dashboard.schemas'

describe('dashboard controllers - navbar message contract behavior', () => {
  function createNavbarSummaryRequest(): Request {
    return new Request('http://localhost/api/operational-incidents/navbar-summary')
  }

  it('returns navbar incidents summary grouped by process', async () => {
    const navbarSummary: NavbarAlertsSummaryReadModel = {
      totalActiveIncidents: 2,
      processes: [
        {
          processId: 'process-1',
          processReference: 'REF-001',
          carrier: 'MSC',
          routeSummary: 'SANTOS → HAMBURG',
          activeIncidentCount: 2,
          affectedContainerCount: 1,
          dominantSeverity: 'danger',
          latestIncidentAt: '2026-03-11T10:00:00.000Z',
          incidents: [
            {
              incidentKey: 'CUSTOMS_HOLD:container-1',
              type: 'CUSTOMS_HOLD',
              category: 'customs',
              severity: 'danger',
              fact: {
                messageKey: 'incidents.fact.customsHoldDetected',
                messageParams: { location: 'HAMBURG' },
              },
              action: {
                actionKey: 'incidents.action.followUpCustoms',
                actionParams: { location: 'HAMBURG' },
                actionKind: 'FOLLOW_UP_CUSTOMS',
              },
              affectedContainerCount: 1,
              triggeredAt: '2026-03-11T10:00:00.000Z',
              containers: [
                {
                  containerId: 'container-1',
                  containerNumber: 'MSCU1111111',
                  lifecycleState: 'ACTIVE',
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

    const response = await controllers.getNavbarOperationalIncidentsSummary({
      request: createNavbarSummaryRequest(),
    })
    const body = NavbarAlertsSummaryResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.total_active_incidents).toBe(2)
    expect(body.processes).toHaveLength(1)
    expect(body.processes[0]?.process_id).toBe('process-1')
    expect(body.processes[0]?.incidents[0]?.fact.message_key).toBe(
      'incidents.fact.customsHoldDetected',
    )
  })
})
