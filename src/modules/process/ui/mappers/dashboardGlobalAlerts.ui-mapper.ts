import type { DashboardGlobalAlertsVM } from '~/modules/process/ui/viewmodels/dashboard-global-alerts.vm'
import type { DashboardGlobalAlertsSummaryResponse } from '~/shared/api-schemas/dashboard.schemas'

export function toDashboardGlobalAlertsVM(
  source: DashboardGlobalAlertsSummaryResponse,
): DashboardGlobalAlertsVM {
  return {
    totalActiveIncidents: source.total_active_incidents,
    affectedContainersCount: source.affected_containers_count,
    recognizedIncidentsCount: source.recognized_incidents_count,
    bySeverity: {
      danger: source.by_severity.danger,
      warning: source.by_severity.warning,
      info: source.by_severity.info,
    },
    byCategory: {
      eta: source.by_category.eta,
      movement: source.by_category.movement,
      customs: source.by_category.customs,
      data: source.by_category.data,
    },
  }
}
