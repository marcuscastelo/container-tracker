import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { DashboardKpisReadModel } from '~/capabilities/dashboard/application/dashboard.kpis.readmodel'
import type { DashboardOperationalSummaryReadModel } from '~/capabilities/dashboard/application/dashboard.operational-summary.readmodel'
import type { DashboardProcessesCreatedByMonthReadModel } from '~/capabilities/dashboard/application/dashboard.processes-created-by-month.readmodel'
import { createDashboardControllers } from '~/capabilities/dashboard/interface/http/dashboard.controllers'
import {
  DashboardKpisResponseSchema,
  DashboardOperationalSummaryResponseSchema,
  DashboardProcessesCreatedByMonthResponseSchema,
} from '~/shared/api-schemas/dashboard.schemas'

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

    const getOperationalSummaryReadModel = vi.fn(async () => summary)

    const controllers = createDashboardControllers({
      dashboardUseCases: {
        getOperationalSummaryReadModel,
        getDashboardKpisReadModel: vi.fn(
          async (): Promise<DashboardKpisReadModel> => ({
            activeProcesses: 0,
            trackedContainers: 0,
            processesWithAlerts: 0,
            lastSyncAt: null,
          }),
        ),
        getProcessesCreatedByMonthReadModel: vi.fn(
          async (): Promise<DashboardProcessesCreatedByMonthReadModel> => ({
            months: [],
          }),
        ),
      },
    })

    const response = await controllers.getOperationalSummary()
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
      eta_current: '2026-03-10T10:00:00.000Z',
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

    const getDashboardKpisReadModel = vi.fn(async () => kpis)

    const controllers = createDashboardControllers({
      dashboardUseCases: {
        getOperationalSummaryReadModel: vi.fn(
          async (): Promise<DashboardOperationalSummaryReadModel> => ({
            globalAlerts: {
              totalActiveAlerts: 0,
              bySeverity: {
                danger: 0,
                warning: 0,
                info: 0,
                success: 0,
              },
              byCategory: {
                eta: 0,
                movement: 0,
                customs: 0,
                status: 0,
                data: 0,
              },
            },
            processes: [],
            activeAlertsPanel: [],
          }),
        ),
        getDashboardKpisReadModel,
        getProcessesCreatedByMonthReadModel: vi.fn(
          async (): Promise<DashboardProcessesCreatedByMonthReadModel> => ({
            months: [],
          }),
        ),
      },
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

  it('returns monthly chart data in chronological order', async () => {
    const monthly: DashboardProcessesCreatedByMonthReadModel = {
      months: [
        { month: '2025-10', label: 'Oct', count: 4 },
        { month: '2025-11', label: 'Nov', count: 7 },
      ],
    }

    const getProcessesCreatedByMonthReadModel = vi.fn(async () => monthly)

    const controllers = createDashboardControllers({
      dashboardUseCases: {
        getOperationalSummaryReadModel: vi.fn(
          async (): Promise<DashboardOperationalSummaryReadModel> => ({
            globalAlerts: {
              totalActiveAlerts: 0,
              bySeverity: {
                danger: 0,
                warning: 0,
                info: 0,
                success: 0,
              },
              byCategory: {
                eta: 0,
                movement: 0,
                customs: 0,
                status: 0,
                data: 0,
              },
            },
            processes: [],
            activeAlertsPanel: [],
          }),
        ),
        getDashboardKpisReadModel: vi.fn(
          async (): Promise<DashboardKpisReadModel> => ({
            activeProcesses: 0,
            trackedContainers: 0,
            processesWithAlerts: 0,
            lastSyncAt: null,
          }),
        ),
        getProcessesCreatedByMonthReadModel,
      },
    })

    const response = await controllers.getProcessesCreatedByMonth({
      request: new Request(
        'http://localhost/api/dashboard/charts/processes-created-by-month?window=12',
      ),
    })
    const body = DashboardProcessesCreatedByMonthResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(getProcessesCreatedByMonthReadModel).toHaveBeenCalledWith({ windowSize: 12 })
    expect(body.months).toEqual([
      { month: '2025-10', label: 'Oct', count: 4 },
      { month: '2025-11', label: 'Nov', count: 7 },
    ])
  })

  it('returns 400 for invalid monthly chart query', async () => {
    const ErrorResponseSchema = z.object({
      error: z.string(),
    })

    const controllers = createDashboardControllers({
      dashboardUseCases: {
        getOperationalSummaryReadModel: vi.fn(
          async (): Promise<DashboardOperationalSummaryReadModel> => ({
            globalAlerts: {
              totalActiveAlerts: 0,
              bySeverity: {
                danger: 0,
                warning: 0,
                info: 0,
                success: 0,
              },
              byCategory: {
                eta: 0,
                movement: 0,
                customs: 0,
                status: 0,
                data: 0,
              },
            },
            processes: [],
            activeAlertsPanel: [],
          }),
        ),
        getDashboardKpisReadModel: vi.fn(
          async (): Promise<DashboardKpisReadModel> => ({
            activeProcesses: 0,
            trackedContainers: 0,
            processesWithAlerts: 0,
            lastSyncAt: null,
          }),
        ),
        getProcessesCreatedByMonthReadModel: vi.fn(
          async (): Promise<DashboardProcessesCreatedByMonthReadModel> => ({
            months: [],
          }),
        ),
      },
    })

    const response = await controllers.getProcessesCreatedByMonth({
      request: new Request(
        'http://localhost/api/dashboard/charts/processes-created-by-month?window=9',
      ),
    })
    const body = ErrorResponseSchema.parse(await response.json())

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid monthly chart query')
  })
})
