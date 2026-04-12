import type { NavbarAlertsSummaryData } from '~/shared/api/navbar-alerts/navbar-alerts.contract'
import type { NavbarAlertsVM } from '~/shared/ui/navbar-alerts/navbar-alerts.vm'

export function toNavbarAlertsVM(source: NavbarAlertsSummaryData): NavbarAlertsVM {
  return {
    totalActiveIncidents: source.total_active_incidents,
    processes: source.processes.map((process) => ({
      processId: process.process_id,
      processReference: process.process_reference,
      carrier: process.carrier,
      routeSummary: process.route_summary,
      activeIncidentCount: process.active_incident_count,
      affectedContainerCount: process.affected_container_count,
      dominantSeverity: process.dominant_severity,
      latestIncidentAt: process.latest_incident_at,
      incidents: process.incidents.map((incident) => ({
        incidentKey: incident.incident_key,
        type: incident.type,
        severity: incident.severity,
        category: incident.category,
        factMessageKey: incident.fact.message_key,
        factMessageParams: incident.fact.message_params,
        action:
          incident.action === null
            ? null
            : {
                actionKey: incident.action.action_key,
                actionParams: incident.action.action_params,
                actionKind: incident.action.action_kind,
              },
        affectedContainerCount: incident.affected_container_count,
        triggeredAt: incident.triggered_at,
        containers: incident.containers.map((container) => ({
          containerId: container.container_id,
          containerNumber: container.container_number,
          lifecycleState: container.lifecycle_state,
        })),
      })),
    })),
  }
}
