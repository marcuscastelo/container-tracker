import type { NavbarAlertsSummaryResponse } from '~/shared/api-schemas/dashboard.schemas'
import type { NavbarAlertsVM } from '~/shared/ui/navbar-alerts/navbar-alerts.vm'

export function toNavbarAlertsVM(source: NavbarAlertsSummaryResponse): NavbarAlertsVM {
  return {
    totalAlerts: source.total_active_alerts,
    processes: source.processes.map((process) => ({
      processId: process.process_id,
      processReference: process.process_reference,
      carrier: process.carrier,
      routeSummary: process.route_summary,
      activeAlertsCount: process.active_alerts_count,
      dominantSeverity: process.dominant_severity,
      latestAlertAt: process.latest_alert_at,
      containers: process.containers.map((container) => ({
        containerId: container.container_id,
        containerNumber: container.container_number,
        status: container.status,
        eta: container.eta,
        activeAlertsCount: container.active_alerts_count,
        dominantSeverity: container.dominant_severity,
        latestAlertAt: container.latest_alert_at,
        alerts: container.alerts.map((alert) => ({
          alertId: alert.alert_id,
          severity: alert.severity,
          category: alert.category,
          messageKey: alert.message_key,
          messageParams: alert.message_params,
          occurredAt: alert.occurred_at,
          retroactive: alert.retroactive,
        })),
      })),
    })),
  }
}
