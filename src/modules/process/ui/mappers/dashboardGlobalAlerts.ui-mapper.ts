import type { DashboardGlobalAlertsVM } from '~/modules/process/ui/viewmodels/dashboard-global-alerts.vm'
import type { DashboardGlobalAlertsSummaryResponse } from '~/shared/api-schemas/dashboard.schemas'

export function toDashboardGlobalAlertsVM(
  source: DashboardGlobalAlertsSummaryResponse,
): DashboardGlobalAlertsVM {
  return {
    totalActiveAlerts: source.total_active_alerts,
    bySeverity: {
      danger: source.by_severity.danger,
      warning: source.by_severity.warning,
      info: source.by_severity.info,
      success: source.by_severity.success,
    },
    byCategory: {
      eta: source.by_category.eta,
      movement: source.by_category.movement,
      customs: source.by_category.customs,
      status: source.by_category.status,
      data: source.by_category.data,
    },
  }
}
