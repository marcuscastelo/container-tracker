import { describe, expect, it } from 'vitest'
import type { NavbarAlertsSummaryData } from '~/shared/api/navbar-alerts/navbar-alerts.contract'
import { toNavbarAlertsVM } from '~/shared/ui/navbar-alerts/navbar-alerts.mapper'

function buildNavbarAlertsSummaryData(): NavbarAlertsSummaryData {
  return {
    generated_at: '2026-04-11T12:00:00.000Z',
    total_active_incidents: 2,
    processes: [
      {
        process_id: 'process-1',
        process_reference: 'REF-001',
        carrier: 'MSC',
        route_summary: 'Shanghai -> Santos',
        active_incident_count: 2,
        affected_container_count: 1,
        dominant_severity: 'warning',
        latest_incident_at: '2026-04-10T09:00:00.000Z',
        incidents: [
          {
            incident_key: 'TRANSSHIPMENT:1:SINES:MSC IRINA:MSC CELESTINO',
            type: 'TRANSSHIPMENT',
            category: 'movement',
            severity: 'warning',
            fact: {
              message_key: 'incidents.fact.transshipmentDetected',
              message_params: {
                port: 'Sines',
                fromVessel: 'MSC Irina',
                toVessel: 'MSC Celestino',
              },
            },
            action: {
              action_key: 'incidents.action.updateRedestination',
              action_params: {},
              action_kind: 'UPDATE_REDESTINATION',
            },
            affected_container_count: 1,
            triggered_at: '2026-04-10T09:00:00.000Z',
            containers: [
              {
                container_id: 'container-1',
                container_number: 'MSCU1234567',
                lifecycle_state: 'ACTIVE',
              },
            ],
          },
        ],
      },
    ],
  }
}

describe('toNavbarAlertsVM', () => {
  it('maps incident-first backend summary data into the navbar view model without reinterpretation', () => {
    expect(toNavbarAlertsVM(buildNavbarAlertsSummaryData())).toEqual({
      totalActiveIncidents: 2,
      processes: [
        {
          processId: 'process-1',
          processReference: 'REF-001',
          carrier: 'MSC',
          routeSummary: 'Shanghai -> Santos',
          activeIncidentCount: 2,
          affectedContainerCount: 1,
          dominantSeverity: 'warning',
          latestIncidentAt: '2026-04-10T09:00:00.000Z',
          incidents: [
            {
              incidentKey: 'TRANSSHIPMENT:1:SINES:MSC IRINA:MSC CELESTINO',
              type: 'TRANSSHIPMENT',
              severity: 'warning',
              category: 'movement',
              factMessageKey: 'incidents.fact.transshipmentDetected',
              factMessageParams: {
                port: 'Sines',
                fromVessel: 'MSC Irina',
                toVessel: 'MSC Celestino',
              },
              action: {
                actionKey: 'incidents.action.updateRedestination',
                actionParams: {},
                actionKind: 'UPDATE_REDESTINATION',
              },
              affectedContainerCount: 1,
              triggeredAt: '2026-04-10T09:00:00.000Z',
              containers: [
                {
                  containerId: 'container-1',
                  containerNumber: 'MSCU1234567',
                  lifecycleState: 'ACTIVE',
                },
              ],
            },
          ],
        },
      ],
    })
  })
})
