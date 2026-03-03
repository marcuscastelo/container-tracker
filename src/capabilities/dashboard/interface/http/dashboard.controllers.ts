import type { DashboardUseCases } from '~/capabilities/dashboard/application/dashboard.usecases'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'
import { DashboardGlobalAlertsSummaryResponseSchema } from '~/shared/api-schemas/dashboard.schemas'

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

export function createDashboardControllers(deps: DashboardControllersDeps) {
  const { dashboardUseCases } = deps

  async function getOperationalGlobalAlertsSummary(): Promise<Response> {
    try {
      const result = await dashboardUseCases.getOperationalSummaryReadModel()
      const response = toDashboardGlobalAlertsResponse(result.globalAlerts)
      return jsonResponse(response, 200, DashboardGlobalAlertsSummaryResponseSchema)
    } catch (err) {
      console.error('GET /api/dashboard/operational-summary error:', err)
      return mapErrorToResponse(err)
    }
  }

  return {
    getOperationalGlobalAlertsSummary,
  }
}

export type DashboardControllers = ReturnType<typeof createDashboardControllers>
