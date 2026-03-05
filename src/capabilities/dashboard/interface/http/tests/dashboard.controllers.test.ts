import { describe, expect, it, vi } from 'vitest'
import type { DashboardOperationalSummaryReadModel } from '~/capabilities/dashboard/application/dashboard.operational-summary.readmodel'
import { createDashboardControllers } from '~/capabilities/dashboard/interface/http/dashboard.controllers'
import { DashboardOperationalSummaryResponseSchema } from '~/shared/api-schemas/dashboard.schemas'

describe('dashboard controllers', () => {
  it('returns operational summary including process exceptions in backend order', async () => {
    const summary: DashboardOperationalSummaryReadModel = {
      globalAlerts: {
        totalActiveAlerts: 3,
        bySeverity: {
          danger: 1,
          warning: 1,
          info: 1,
          success: 0,
        },
        byCategory: {
          eta: 1,
          movement: 1,
          customs: 0,
          status: 1,
          data: 0,
        },
      },
      processes: [
        {
          processId: 'process-danger',
          reference: 'REF-DANGER',
          origin: 'Ningbo',
          destination: 'Antwerp',
          status: 'IN_TRANSIT',
          eta: '2026-03-10T10:00:00.000Z',
          dominantSeverity: 'danger',
          activeAlertsCount: 2,
          activeAlerts: [],
        },
        {
          processId: 'process-none',
          reference: 'REF-NONE',
          origin: 'Santos',
          destination: 'Valencia',
          status: 'LOADED',
          eta: null,
          dominantSeverity: 'none',
          activeAlertsCount: 0,
          activeAlerts: [],
        },
      ],
      activeAlertsPanel: [],
    }

    const getOperationalSummaryReadModel = vi.fn(async () => summary)

    const controllers = createDashboardControllers({
      dashboardUseCases: {
        getOperationalSummaryReadModel,
      },
    })

    const response = await controllers.getOperationalSummary()
    const body = DashboardOperationalSummaryResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.total_active_alerts).toBe(3)
    expect(body.by_severity).toEqual({
      danger: 1,
      warning: 1,
      info: 1,
      success: 0,
    })
    expect(body.process_exceptions.map((process) => process.process_id)).toEqual([
      'process-danger',
      'process-none',
    ])
    expect(body.process_exceptions[0]).toEqual({
      process_id: 'process-danger',
      reference: 'REF-DANGER',
      origin: 'Ningbo',
      destination: 'Antwerp',
      derived_status: 'IN_TRANSIT',
      eta_current: '2026-03-10T10:00:00.000Z',
      dominant_severity: 'danger',
      active_alert_count: 2,
    })
    expect(body.process_exceptions[1]).toEqual({
      process_id: 'process-none',
      reference: 'REF-NONE',
      origin: 'Santos',
      destination: 'Valencia',
      derived_status: 'LOADED',
      eta_current: null,
      dominant_severity: 'none',
      active_alert_count: 0,
    })
  })
})
