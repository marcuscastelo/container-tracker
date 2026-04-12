import type { PredictionHistorySource } from '~/modules/process/ui/mappers/predictionHistory.ui-mapper'
import type { AlertIncidentVM } from '~/modules/process/ui/viewmodels/alert-incident.vm'
import type { ContainerObservationVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { typedFetch } from '~/shared/api/typedFetch'
import {
  ObservationResponseSchema,
  ProcessRecognizedOperationalIncidentsResponseSchema,
  ProcessSyncSnapshotResponseSchema,
  TrackingPredictionHistoryResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

function toReadTriggerHeaders(triggeredBy: string): HeadersInit {
  return {
    'x-process-read-trigger': triggeredBy,
  }
}

function toObservationInspectorVm(
  observation: ReturnType<typeof ObservationResponseSchema.parse>,
): ContainerObservationVM {
  return {
    id: observation.id,
    type: observation.type,
    eventTime: observation.event_time,
    eventTimeType: observation.event_time_type,
    rawEventTime: observation.raw_event_time ?? null,
    eventTimeSource: observation.event_time_source ?? null,
    locationCode: observation.location_code,
    locationDisplay: observation.location_display,
    vesselName: observation.vessel_name,
    voyage: observation.voyage,
    isEmpty: observation.is_empty,
    provider: observation.provider,
    carrierLabel: observation.carrier_label ?? null,
    confidence: observation.confidence,
    retroactive: observation.retroactive ?? false,
    fingerprint: observation.fingerprint,
    createdAt: observation.created_at,
    createdFromSnapshotId: observation.created_from_snapshot_id ?? null,
  }
}

function toPredictionHistorySource(
  predictionHistory: ReturnType<typeof TrackingPredictionHistoryResponseSchema.parse>,
): PredictionHistorySource {
  return {
    header: {
      tone: predictionHistory.header.tone,
      summaryKind: predictionHistory.header.summary_kind,
      currentVersionId: predictionHistory.header.current_version_id,
      previousVersionId: predictionHistory.header.previous_version_id,
      originalVersionId: predictionHistory.header.original_version_id,
      reasonKind: predictionHistory.header.reason_kind,
    },
    versions: predictionHistory.versions.map((version) => ({
      id: version.id,
      isCurrent: version.is_current,
      type: version.type,
      eventTime: version.event_time,
      eventTimeType: version.event_time_type,
      vesselName: version.vessel_name,
      voyage: version.voyage,
      versionState: version.version_state,
      explanatoryTextKind: version.explanatory_text_kind,
      transitionKindFromPreviousVersion: version.transition_kind_from_previous_version,
      observedAtCount: version.observed_at_count,
      observedAtList: [...version.observed_at_list],
      firstObservedAt: version.first_observed_at,
      lastObservedAt: version.last_observed_at,
    })),
  }
}

function toAlertIncidentVm(
  incident: ReturnType<
    typeof ProcessRecognizedOperationalIncidentsResponseSchema.parse
  >['recognized'][number],
): AlertIncidentVM {
  const transshipmentOrder = (() => {
    if (incident.type !== 'TRANSSHIPMENT' && incident.type !== 'PLANNED_TRANSSHIPMENT') {
      return null
    }

    const [, maybeOrder] = incident.incident_key.split(':')
    const order = Number(maybeOrder ?? '')
    return Number.isInteger(order) && order > 0 ? order : null
  })()
  const port = typeof incident.fact.message_params.port === 'string'
    ? incident.fact.message_params.port
    : null
  const fromVessel = typeof incident.fact.message_params.fromVessel === 'string'
    ? incident.fact.message_params.fromVessel
    : null
  const toVessel = typeof incident.fact.message_params.toVessel === 'string'
    ? incident.fact.message_params.toVessel
    : null
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
    transshipmentOrder,
    port,
    fromVessel,
    toVessel,
    affectedContainerCount: incident.scope.affected_container_count,
    activeAlertIds,
    ackedAlertIds,
    members: incident.members.map((member) => ({
      containerId: member.container_id,
      containerNumber: member.container_number,
      lifecycleState: member.lifecycle_state,
      detectedAtIso: member.detected_at,
      transshipmentOrder,
      port,
      fromVessel,
      toVessel,
      records: member.records.map((record) => ({
        alertId: record.alert_id,
        lifecycleState: record.lifecycle_state,
        detectedAtIso: record.detected_at,
        triggeredAtIso: record.triggered_at,
        ackedAtIso: record.acked_at,
        resolvedAtIso: record.resolved_at,
        resolvedReason: record.resolved_reason,
      })),
    })),
  }
}

export async function fetchProcessSyncSnapshot(processId: string) {
  return typedFetch(
    `/api/processes/${encodeURIComponent(processId)}/sync-state`,
    {
      headers: toReadTriggerHeaders('shipment_reconciliation'),
    },
    ProcessSyncSnapshotResponseSchema,
  )
}

export async function fetchRecognizedAlertIncidents(
  processId: string,
): Promise<readonly AlertIncidentVM[]> {
  const response = await typedFetch(
    `/api/processes/${encodeURIComponent(processId)}/operational-incidents/recognized`,
    undefined,
    ProcessRecognizedOperationalIncidentsResponseSchema,
  )

  return response.recognized.map(toAlertIncidentVm)
}

export async function fetchTimelinePredictionHistory(
  containerId: string,
  timelineItemId: string,
): Promise<PredictionHistorySource> {
  const response = await typedFetch(
    `/api/tracking/containers/${encodeURIComponent(containerId)}/timeline-items/${encodeURIComponent(timelineItemId)}/history`,
    undefined,
    TrackingPredictionHistoryResponseSchema,
  )

  return toPredictionHistorySource(response)
}

export async function fetchObservationInspector(
  containerId: string,
  observationId: string,
): Promise<ContainerObservationVM> {
  const response = await typedFetch(
    `/api/tracking/containers/${encodeURIComponent(containerId)}/observations/${encodeURIComponent(observationId)}`,
    undefined,
    ObservationResponseSchema,
  )

  return toObservationInspectorVm(response)
}
