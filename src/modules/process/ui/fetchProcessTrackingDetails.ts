import type { AlertIncidentVM } from '~/modules/process/ui/viewmodels/alert-incident.vm'
import type { ContainerObservationVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import type { TrackingSeriesHistory } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { typedFetch } from '~/shared/api/typedFetch'
import {
  ObservationResponseSchema,
  ProcessRecognizedAlertIncidentsResponseSchema,
  ProcessSyncSnapshotResponseSchema,
  TrackingTimelineSeriesHistoryResponseSchema,
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

function toSeriesHistory(
  seriesHistory: ReturnType<typeof TrackingTimelineSeriesHistoryResponseSchema.parse>,
): TrackingSeriesHistory {
  return {
    hasActualConflict: seriesHistory.has_actual_conflict,
    classified: seriesHistory.classified.map((item) => ({
      id: item.id,
      type: item.type,
      event_time: item.event_time,
      event_time_type: item.event_time_type,
      created_at: item.created_at,
      seriesLabel: item.series_label,
    })),
  }
}

function toAlertIncidentVm(
  incident: ReturnType<
    typeof ProcessRecognizedAlertIncidentsResponseSchema.parse
  >['recognized'][number],
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
      transshipmentOrder: member.transshipment_order,
      port: member.port,
      fromVessel: member.from_vessel,
      toVessel: member.to_vessel,
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
    `/api/processes/${encodeURIComponent(processId)}/alerts/recognized`,
    undefined,
    ProcessRecognizedAlertIncidentsResponseSchema,
  )

  return response.recognized.map(toAlertIncidentVm)
}

export async function fetchTimelineSeriesHistory(
  containerId: string,
  timelineItemId: string,
): Promise<TrackingSeriesHistory> {
  const response = await typedFetch(
    `/api/tracking/containers/${encodeURIComponent(containerId)}/timeline-items/${encodeURIComponent(timelineItemId)}/history`,
    undefined,
    TrackingTimelineSeriesHistoryResponseSchema,
  )

  return toSeriesHistory(response)
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
