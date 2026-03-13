import type { DashboardMonthWindowSize } from '~/capabilities/dashboard/application/dashboard.processes-created-by-month.readmodel'
import type { DashboardUseCases } from '~/capabilities/dashboard/application/dashboard.usecases'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'
import {
  DashboardKpisResponseSchema,
  DashboardOperationalSummaryResponseSchema,
  type DashboardProcessesCreatedByMonthQuery,
  DashboardProcessesCreatedByMonthQuerySchema,
  DashboardProcessesCreatedByMonthResponseSchema,
} from '~/shared/api-schemas/dashboard.schemas'

type DashboardControllersDeps = {
  readonly dashboardUseCases: Pick<
    DashboardUseCases,
    | 'getOperationalSummaryReadModel'
    | 'getDashboardKpisReadModel'
    | 'getProcessesCreatedByMonthReadModel'
  >
}

function toDashboardGlobalAlertsResponse(
  summary: Awaited<ReturnType<DashboardUseCases['getOperationalSummaryReadModel']>>['globalAlerts'],
) {
  return {
    total_active_alerts: summary.totalActiveAlerts,
    by_severity: {
      danger: summary.bySeverity.danger,
      warning: summary.bySeverity.warning,
      info: summary.bySeverity.info,
      success: summary.bySeverity.success,
    },
    by_category: {
      eta: summary.byCategory.eta,
      movement: summary.byCategory.movement,
      customs: summary.byCategory.customs,
      status: summary.byCategory.status,
      data: summary.byCategory.data,
    },
  }
}

function toDashboardProcessExceptionsResponse(
  processes: Awaited<ReturnType<DashboardUseCases['getOperationalSummaryReadModel']>>['processes'],
) {
  return processes.map((process) => ({
    process_id: process.processId,
    reference: process.reference,
    origin: process.origin,
    destination: process.destination,
    derived_status: process.status,
    eta_current: process.eta,
    dominant_severity: process.dominantSeverity,
    dominant_alert_created_at: process.dominantAlertCreatedAt,
    active_alert_count: process.activeAlertsCount,
  }))
}

function toDashboardMonthWindowSize(
  value: DashboardProcessesCreatedByMonthQuery['window'],
): DashboardMonthWindowSize | undefined {
  if (value === '6') return 6
  if (value === '12') return 12
  if (value === '24') return 24
  return undefined
}

export function createDashboardControllers(deps: DashboardControllersDeps) {
  const { dashboardUseCases } = deps

  async function getOperationalSummary(): Promise<Response> {
    try {
      const result = await dashboardUseCases.getOperationalSummaryReadModel()
      const generatedAt = new Date().toISOString()
      const response = {
        generated_at: generatedAt,
        ...toDashboardGlobalAlertsResponse(result.globalAlerts),
        process_exceptions: toDashboardProcessExceptionsResponse(result.processes),
      }
      return jsonResponse(response, 200, DashboardOperationalSummaryResponseSchema)
    } catch (err) {
      console.error('GET /api/dashboard/operational-summary error:', err)
      return mapErrorToResponse(err)
    }
  }

  async function getKpis(): Promise<Response> {
    try {
      const result = await dashboardUseCases.getDashboardKpisReadModel()
      const response = {
        activeProcesses: result.activeProcesses,
        trackedContainers: result.trackedContainers,
        processesWithAlerts: result.processesWithAlerts,
        lastSyncAt: result.lastSyncAt,
      }
      return jsonResponse(response, 200, DashboardKpisResponseSchema)
    } catch (err) {
      console.error('GET /api/dashboard/kpis error:', err)
      return mapErrorToResponse(err)
    }
  }

  async function getProcessesCreatedByMonth({ request }: { request: Request }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const parsedQuery = DashboardProcessesCreatedByMonthQuerySchema.safeParse({
        window: url.searchParams.get('window') ?? undefined,
      })

      if (!parsedQuery.success) {
        return jsonResponse(
          { error: `Invalid monthly chart query: ${parsedQuery.error.message}` },
          400,
        )
      }

      const result = await dashboardUseCases.getProcessesCreatedByMonthReadModel({
        windowSize: toDashboardMonthWindowSize(parsedQuery.data.window),
      })
      const response = {
        months: result.months.map((item) => ({
          month: item.month,
          label: item.label,
          count: item.count,
        })),
      }
      return jsonResponse(response, 200, DashboardProcessesCreatedByMonthResponseSchema)
    } catch (err) {
      console.error('GET /api/dashboard/charts/processes-created-by-month error:', err)
      return mapErrorToResponse(err)
    }
  }

  return {
    getOperationalSummary,
    getKpis,
    getProcessesCreatedByMonth,
  }
}

export type DashboardControllers = ReturnType<typeof createDashboardControllers>
