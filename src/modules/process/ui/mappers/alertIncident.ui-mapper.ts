import type {
  AlertIncidentRecordVM,
  AlertIncidentsVM,
  AlertIncidentVM,
} from '~/modules/process/ui/viewmodels/alert-incident.vm'
import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'

type AlertIncidentsResponse = ProcessDetailResponse['alert_incidents']

function toAlertIncidentRecordVm(
  record: NonNullable<AlertIncidentsResponse>['active'][number]['monitoring_history'][number],
): AlertIncidentRecordVM {
  return {
    alertId: record.alert_id,
    lifecycleState: record.lifecycle_state,
    detectedAtIso: record.detected_at,
    triggeredAtIso: record.triggered_at,
    ackedAtIso: record.acked_at,
    resolvedAtIso: record.resolved_at,
    resolvedReason: record.resolved_reason,
    thresholdDays: record.threshold_days,
    daysWithoutMovement: record.days_without_movement,
    lastEventDate: record.last_event_date,
  }
}

function toAlertIncidentVm(
  incident: NonNullable<AlertIncidentsResponse>['active'][number],
): AlertIncidentVM {
  return {
    incidentKey: incident.incident_key,
    bucket: incident.bucket,
    category: incident.category,
    type: incident.type,
    severity: incident.severity,
    messageKey: incident.message_key,
    messageParams: incident.message_params,
    detectedAtIso: incident.detected_at,
    triggeredAtIso: incident.triggered_at,
    thresholdDays: incident.threshold_days,
    daysWithoutMovement: incident.days_without_movement,
    lastEventDate: incident.last_event_date,
    transshipmentOrder: incident.transshipment_order,
    port: incident.port,
    fromVessel: incident.from_vessel,
    toVessel: incident.to_vessel,
    affectedContainerCount: incident.affected_container_count,
    activeAlertIds: [...incident.active_alert_ids],
    ackedAlertIds: [...incident.acked_alert_ids],
    members: incident.members.map((member) => ({
      containerId: member.container_id,
      containerNumber: member.container_number,
      lifecycleState: member.lifecycle_state,
      detectedAtIso: member.detected_at,
      thresholdDays: member.threshold_days,
      daysWithoutMovement: member.days_without_movement,
      lastEventDate: member.last_event_date,
      transshipmentOrder: member.transshipment_order,
      port: member.port,
      fromVessel: member.from_vessel,
      toVessel: member.to_vessel,
      records: member.records.map(toAlertIncidentRecordVm),
    })),
    monitoringHistory: incident.monitoring_history.map(toAlertIncidentRecordVm),
  }
}

export function toAlertIncidentsVm(alertIncidents: AlertIncidentsResponse): AlertIncidentsVM {
  if (alertIncidents === undefined) {
    return {
      summary: {
        activeIncidents: 0,
        affectedContainers: 0,
        recognizedIncidents: 0,
      },
      active: [],
      recognized: [],
    }
  }

  return {
    summary: {
      activeIncidents: alertIncidents.summary.active_incidents,
      affectedContainers: alertIncidents.summary.affected_containers,
      recognizedIncidents: alertIncidents.summary.recognized_incidents,
    },
    active: alertIncidents.active.map(toAlertIncidentVm),
    recognized: alertIncidents.recognized.map(toAlertIncidentVm),
  }
}
