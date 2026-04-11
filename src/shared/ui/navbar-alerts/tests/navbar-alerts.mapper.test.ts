import { describe, expect, it } from 'vitest'
import type { NavbarAlertsSummaryData } from '~/shared/api/navbar-alerts/navbar-alerts.contract'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'
import { toNavbarAlertsVM } from '~/shared/ui/navbar-alerts/navbar-alerts.mapper'

function buildNavbarAlertsSummaryData(): NavbarAlertsSummaryData {
  return {
    generated_at: '2026-04-11T12:00:00.000Z',
    total_active_alerts: 2,
    processes: [
      {
        process_id: 'process-1',
        process_reference: 'REF-001',
        carrier: 'MSC',
        route_summary: 'Shanghai -> Santos',
        active_alerts_count: 2,
        dominant_severity: 'warning',
        latest_alert_at: '2026-04-10T09:00:00.000Z',
        containers: [
          {
            container_id: 'container-1',
            container_number: 'MSCU1234567',
            status: 'IN_TRANSIT',
            eta: temporalDtoFromCanonical('2026-04-20T00:00:00.000Z'),
            active_alerts_count: 2,
            dominant_severity: 'warning',
            latest_alert_at: '2026-04-10T09:00:00.000Z',
            alerts: [
              {
                alert_id: 'alert-1',
                severity: 'warning',
                category: 'monitoring',
                message_key: 'alerts.etaPassed',
                message_params: {},
                occurred_at: '2026-04-10T09:00:00.000Z',
                retroactive: false,
              },
              {
                alert_id: 'alert-2',
                severity: 'info',
                category: 'fact',
                message_key: 'alerts.transshipmentDetected',
                message_params: {
                  port: 'Sines',
                  fromVessel: 'MSC Irina',
                  toVessel: 'MSC Celestino',
                },
                occurred_at: '2026-04-09T18:30:00.000Z',
                retroactive: true,
              },
            ],
          },
        ],
      },
    ],
  }
}

describe('toNavbarAlertsVM', () => {
  it('maps nested backend summary data into the navbar alert view model without reinterpretation', () => {
    expect(toNavbarAlertsVM(buildNavbarAlertsSummaryData())).toEqual({
      totalAlerts: 2,
      processes: [
        {
          processId: 'process-1',
          processReference: 'REF-001',
          carrier: 'MSC',
          routeSummary: 'Shanghai -> Santos',
          activeAlertsCount: 2,
          dominantSeverity: 'warning',
          latestAlertAt: '2026-04-10T09:00:00.000Z',
          containers: [
            {
              containerId: 'container-1',
              containerNumber: 'MSCU1234567',
              status: 'IN_TRANSIT',
              eta: temporalDtoFromCanonical('2026-04-20T00:00:00.000Z'),
              activeAlertsCount: 2,
              dominantSeverity: 'warning',
              latestAlertAt: '2026-04-10T09:00:00.000Z',
              alerts: [
                {
                  alertId: 'alert-1',
                  severity: 'warning',
                  category: 'monitoring',
                  messageKey: 'alerts.etaPassed',
                  messageParams: {},
                  occurredAt: '2026-04-10T09:00:00.000Z',
                  retroactive: false,
                },
                {
                  alertId: 'alert-2',
                  severity: 'info',
                  category: 'fact',
                  messageKey: 'alerts.transshipmentDetected',
                  messageParams: {
                    port: 'Sines',
                    fromVessel: 'MSC Irina',
                    toVessel: 'MSC Celestino',
                  },
                  occurredAt: '2026-04-09T18:30:00.000Z',
                  retroactive: true,
                },
              ],
            },
          ],
        },
      ],
    })
  })
})
