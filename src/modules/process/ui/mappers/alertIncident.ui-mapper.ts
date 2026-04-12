import type {
  AlertIncidentRecordVM,
  AlertIncidentsVM,
  AlertIncidentVM,
} from '~/modules/process/ui/viewmodels/alert-incident.vm'
import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'

type OperationalIncidentsResponse = ProcessDetailResponse['operational_incidents']

function toTransshipmentOrder(incidentKey: string, type: AlertIncidentVM['type']): number | null {
  if (type !== 'TRANSSHIPMENT' && type !== 'PLANNED_TRANSSHIPMENT') return null

  const [, maybeOrder] = incidentKey.split(':')
  const order = Number(maybeOrder ?? '')
  return Number.isInteger(order) && order > 0 ? order : null
}

function toTransshipmentParams(
  incident: NonNullable<OperationalIncidentsResponse>['active'][number],
): {
  readonly port: string | null
  readonly fromVessel: string | null
  readonly toVessel: string | null
} {
  const messageParams = incident.fact.message_params
  const port = typeof messageParams.port === 'string' ? messageParams.port : null
  const fromVessel = typeof messageParams.fromVessel === 'string' ? messageParams.fromVessel : null
  const toVessel = typeof messageParams.toVessel === 'string' ? messageParams.toVessel : null

  return {
    port,
    fromVessel,
    toVessel,
  }
}

function toAlertIncidentRecordVm(
  record: NonNullable<OperationalIncidentsResponse>['active'][number]['members'][number]['records'][number],
): AlertIncidentRecordVM {
  return {
    alertId: record.alert_id,
    lifecycleState: record.lifecycle_state,
    detectedAtIso: record.detected_at,
    triggeredAtIso: record.triggered_at,
    ackedAtIso: record.acked_at,
    resolvedAtIso: record.resolved_at,
    resolvedReason: record.resolved_reason,
  }
}

function toAlertIncidentVm(
  incident: NonNullable<OperationalIncidentsResponse>['active'][number],
): AlertIncidentVM {
  const transshipmentParams = toTransshipmentParams(incident)
  const activeAlertIds = incident.members.flatMap((member) =>
    member.records
      .filter((record) => record.lifecycle_state === 'ACTIVE')
      .map((record) => record.alert_id),
  )
  const ackedAlertIds = incident.members.flatMap((member) =>
    member.records
      .filter((record) => record.lifecycle_state === 'ACKED')
      .map((record) => record.alert_id),
  )

  return {
    incidentKey: incident.incident_key,
    bucket: incident.bucket,
    category: incident.category,
    type: incident.type,
    severity: incident.severity,
    messageKey: incident.fact.message_key,
    messageParams: incident.fact.message_params,
    action:
      incident.action === null
        ? null
        : {
            actionKey: incident.action.action_key,
            actionParams: incident.action.action_params,
            actionKind: incident.action.action_kind,
          },
    detectedAtIso: incident.detected_at,
    triggeredAtIso: incident.triggered_at,
    transshipmentOrder: toTransshipmentOrder(incident.incident_key, incident.type),
    port: transshipmentParams.port,
    fromVessel: transshipmentParams.fromVessel,
    toVessel: transshipmentParams.toVessel,
    affectedContainerCount: incident.scope.affected_container_count,
    activeAlertIds,
    ackedAlertIds,
    members: incident.members.map((member) => ({
      containerId: member.container_id,
      containerNumber: member.container_number,
      lifecycleState: member.lifecycle_state,
      detectedAtIso: member.detected_at,
      transshipmentOrder: toTransshipmentOrder(incident.incident_key, incident.type),
      port: transshipmentParams.port,
      fromVessel: transshipmentParams.fromVessel,
      toVessel: transshipmentParams.toVessel,
      records: member.records.map(toAlertIncidentRecordVm),
    })),
  }
}

export function toAlertIncidentsVm(
  operationalIncidents: OperationalIncidentsResponse,
): AlertIncidentsVM {
  if (operationalIncidents === undefined) {
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
      activeIncidents: operationalIncidents.summary.active_incidents,
      affectedContainers: operationalIncidents.summary.affected_containers,
      recognizedIncidents: operationalIncidents.summary.recognized_incidents,
    },
    active: operationalIncidents.active.map(toAlertIncidentVm),
    recognized: (operationalIncidents.recognized ?? []).map(toAlertIncidentVm),
  }
}
