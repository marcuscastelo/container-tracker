import { describe, expect, it } from 'vitest'
import type { DashboardKpisReadModel } from '~/capabilities/dashboard/application/dashboard.kpis.readmodel'
import type { DashboardOperationalSummaryReadModel } from '~/capabilities/dashboard/application/dashboard.operational-summary.readmodel'
import { createDashboardControllersHarness } from '~/capabilities/dashboard/interface/http/tests/dashboard.controllers.test.helpers'
import {
  DashboardKpisResponseSchema,
  DashboardOperationalSummaryResponseSchema,
} from '~/shared/api-schemas/dashboard.schemas'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

describe('dashboard controllers - boundary behavior', () => {
  function createDashboardRequest(): Request {
    return new Request('http://localhost/api/dashboard/operational-summary')
  }

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
          eta: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
          dominantSeverity: 'danger',
          dominantAlertCreatedAt: '2026-03-10T09:30:00.000Z',
          activeAlertsCount: 2,
          activeAlerts: [],
        },
        {
          processId: 'process-none',
          reference: 'REF-NONE',
          origin: 'Santos',
          destination: 'Valencia',
          status: 'BOOKED',
          eta: null,
          dominantSeverity: 'none',
          dominantAlertCreatedAt: null,
          activeAlertsCount: 0,
          activeAlerts: [],
        },
      ],
      activeAlertsPanel: [],
    }

    const { controllers } = createDashboardControllersHarness({
      getOperationalSummaryReadModel: async () => summary,
    })

    const response = await controllers.getOperationalSummary({
      request: createDashboardRequest(),
    })
    const body = DashboardOperationalSummaryResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(typeof body.generated_at).toBe('string')
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
      eta_current: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
      dominant_severity: 'danger',
      dominant_alert_created_at: '2026-03-10T09:30:00.000Z',
      active_alert_count: 2,
    })
    expect(body.process_exceptions[1]).toEqual({
      process_id: 'process-none',
      reference: 'REF-NONE',
      origin: 'Santos',
      destination: 'Valencia',
      derived_status: 'BOOKED',
      eta_current: null,
      dominant_severity: 'none',
      dominant_alert_created_at: null,
      active_alert_count: 0,
    })
  })

  it('returns dashboard kpis in camelCase contract', async () => {
    const kpis: DashboardKpisReadModel = {
      activeProcesses: 24,
      trackedContainers: 61,
      processesWithAlerts: 8,
      lastSyncAt: '2026-03-12T13:42:00.000Z',
    }

    const { controllers } = createDashboardControllersHarness({
      getDashboardKpisReadModel: async () => kpis,
    })

    const response = await controllers.getKpis()
    const body = DashboardKpisResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body).toEqual({
      activeProcesses: 24,
      trackedContainers: 61,
      processesWithAlerts: 8,
      lastSyncAt: '2026-03-12T13:42:00.000Z',
    })
  })
})
