import type { DashboardUseCases } from '~/capabilities/dashboard/application/dashboard.usecases'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'
import { DashboardOperationalSummaryResponseSchema } from '~/shared/api-schemas/dashboard.schemas'

export type DashboardControllersDeps = {
  readonly dashboardUseCases: Pick<DashboardUseCases, 'getOperationalSummaryReadModel'>
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
    active_alert_count: process.activeAlertsCount,
  }))
}

export function createDashboardControllers(deps: DashboardControllersDeps) {
  const { dashboardUseCases } = deps

  async function getOperationalSummary(): Promise<Response> {
    try {
      const result = await dashboardUseCases.getOperationalSummaryReadModel()
      const response = {
        ...toDashboardGlobalAlertsResponse(result.globalAlerts),
        process_exceptions: toDashboardProcessExceptionsResponse(result.processes),
      }
      return jsonResponse(response, 200, DashboardOperationalSummaryResponseSchema)
    } catch (err) {
      console.error('GET /api/dashboard/operational-summary error:', err)
      return mapErrorToResponse(err)
    }
  }

  return {
    getOperationalSummary,
  }
}

export type DashboardControllers = ReturnType<typeof createDashboardControllers>
