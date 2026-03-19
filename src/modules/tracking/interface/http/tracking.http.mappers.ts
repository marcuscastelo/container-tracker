import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingAlertDisplayReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.alert-display.readmodel'
import { toTrackingAlertDisplayReadModels } from '~/modules/tracking/features/alerts/application/projection/tracking.alert-display.readmodel'
import { toTrackingAlertMessageContract } from '~/modules/tracking/features/alerts/application/projection/tracking.alert-message-contract.mapper'
import { resolveAlertLifecycleState } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type {
  TrackingReplayDebugResult,
  TrackingReplaySeries,
  TrackingReplayState,
  TrackingReplayStep,
  TrackingTimeTravelCheckpoint,
  TrackingTimeTravelDiff,
  TrackingTimeTravelResult,
} from '~/modules/tracking/features/replay/application/tracking.replay.types'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import type {
  AlertResponseDto,
  SnapshotResponseDto,
  TrackingReplayDebugResponseDto,
  TrackingTimeTravelCheckpointResponseDto,
  TrackingTimeTravelDiffResponseDto,
  TrackingTimeTravelResponseDto,
} from '~/modules/tracking/interface/http/tracking.schemas'

// ---------------------------------------------------------------------------
// Alerts — Result → Response DTO mappers
// ---------------------------------------------------------------------------

/**
 * Maps a tracking alert display read model to the HTTP response DTO.
 *
 * This is the only place that shapes alert display data for the HTTP boundary.
 */
export function toAlertResponseDto(alert: TrackingAlertDisplayReadModel): AlertResponseDto {
  const lifecycleState = resolveAlertLifecycleState(alert)
  return {
    id: alert.id,
    container_number: alert.container_number,
    category: alert.category,
    type: alert.type,
    severity: alert.severity,
    ...toTrackingAlertMessageContract(alert),
    detected_at: alert.detected_at,
    triggered_at: alert.triggered_at,
    retroactive: alert.retroactive,
    provider: alert.provider,
    lifecycle_state: lifecycleState,
    acked_at: alert.acked_at,
    resolved_at: alert.resolved_at ?? null,
    resolved_reason: alert.resolved_reason ?? null,
  }
}

// ---------------------------------------------------------------------------
// Snapshots — Result → Response DTO mappers
// ---------------------------------------------------------------------------

/**
 * Maps a domain Snapshot to the HTTP response DTO (minimal shape).
 */
export function toSnapshotResponseDto(snapshot: Snapshot): SnapshotResponseDto {
  return {
    id: snapshot.id,
    container_id: snapshot.container_id,
    provider: snapshot.provider,
    fetched_at: snapshot.fetched_at,
    parse_error: snapshot.parse_error ?? null,
  }
}

function toObservationResponseDto(observation: Observation) {
  return {
    id: observation.id,
    fingerprint: observation.fingerprint,
    type: observation.type,
    carrier_label: observation.carrier_label ?? null,
    event_time: observation.event_time,
    event_time_type: observation.event_time_type,
    location_code: observation.location_code,
    location_display: observation.location_display,
    vessel_name: observation.vessel_name,
    voyage: observation.voyage,
    is_empty: observation.is_empty,
    confidence: observation.confidence,
    provider: observation.provider,
    created_from_snapshot_id: observation.created_from_snapshot_id,
    retroactive: observation.retroactive ?? false,
    created_at: observation.created_at,
  }
}

function toReplaySeriesResponseDto(series: TrackingReplaySeries) {
  return {
    key: series.key,
    primary: {
      id: series.primary.id,
      type: series.primary.type,
      event_time: series.primary.eventTime,
      event_time_type: series.primary.eventTimeType,
    },
    has_actual_conflict: series.hasActualConflict,
    items: series.items.map((item) => ({
      id: item.id,
      type: item.type,
      event_time: item.eventTime,
      event_time_type: item.eventTimeType,
      created_at: item.createdAt,
      series_label: item.seriesLabel,
    })),
  }
}

function toReplayTimelineItemResponseDto(item: TrackingTimelineItem) {
  return {
    id: item.id,
    type: item.type,
    carrier_label: item.carrierLabel ?? null,
    location: item.location ?? null,
    event_time_iso: item.eventTimeIso,
    event_time_type: item.eventTimeType,
    derived_state: item.derivedState,
    vessel_name: item.vesselName ?? null,
    voyage: item.voyage ?? null,
    series_history: item.seriesHistory
      ? {
          has_actual_conflict: item.seriesHistory.hasActualConflict,
          classified: item.seriesHistory.classified.map((historyItem) => ({
            id: historyItem.id,
            type: historyItem.type,
            event_time: historyItem.event_time,
            event_time_type: historyItem.event_time_type,
            created_at: historyItem.created_at,
            series_label: historyItem.seriesLabel,
          })),
        }
      : null,
  }
}

function toReplayAlertsResponseDto(
  alerts: TrackingReplayState['alerts'],
  containerNumber: string | null,
): readonly AlertResponseDto[] {
  if (containerNumber === null) return []
  return toTrackingAlertDisplayReadModels(alerts, () => containerNumber).map(toAlertResponseDto)
}

function toReplayStateResponseDto(state: TrackingReplayState, containerNumber: string | null) {
  return {
    observations: state.observations.map(toObservationResponseDto),
    series: state.series.map(toReplaySeriesResponseDto),
    timeline: state.timeline.map(toReplayTimelineItemResponseDto),
    status: state.status,
    alerts: [...toReplayAlertsResponseDto(state.alerts, containerNumber)],
  }
}

function toReplayStepResponseDto(step: TrackingReplayStep, containerNumber: string | null) {
  return {
    step_index: step.stepIndex,
    snapshot_id: step.snapshotId,
    observation_id: step.observationId,
    stage: step.stage,
    input: step.input,
    output: step.output,
    timestamp: step.timestamp,
    state: toReplayStateResponseDto(step.state, containerNumber),
  }
}

function toTrackingOperationalEtaResponseDto(eta: TrackingTimeTravelCheckpoint['eta']) {
  if (eta === null) return null

  return {
    event_time: eta.eventTimeIso,
    event_time_type: eta.eventTimeType,
    state: eta.state,
    type: eta.type,
    location_code: eta.locationCode,
    location_display: eta.locationDisplay,
  }
}

function toTrackingTimeTravelDiffResponseDto(
  diff: TrackingTimeTravelDiff,
): TrackingTimeTravelDiffResponseDto {
  if (diff.kind === 'initial') {
    return {
      kind: 'initial',
    }
  }

  return {
    kind: 'comparison',
    status_changed: diff.statusChanged,
    previous_status: diff.previousStatus,
    current_status: diff.currentStatus,
    timeline_changed: diff.timelineChanged,
    added_timeline_item_ids: [...diff.addedTimelineItemIds],
    removed_timeline_item_ids: [...diff.removedTimelineItemIds],
    alerts_changed: diff.alertsChanged,
    new_alert_fingerprints: [...diff.newAlertFingerprints],
    resolved_alert_fingerprints: [...diff.resolvedAlertFingerprints],
    eta_changed: diff.etaChanged,
    previous_eta: toTrackingOperationalEtaResponseDto(diff.previousEta),
    current_eta: toTrackingOperationalEtaResponseDto(diff.currentEta),
    actual_conflict_appeared: diff.actualConflictAppeared,
    actual_conflict_resolved: diff.actualConflictResolved,
  }
}

function toTrackingTimeTravelCheckpointResponseDto(
  checkpoint: TrackingTimeTravelCheckpoint,
  containerNumber: string | null,
): TrackingTimeTravelCheckpointResponseDto {
  return {
    snapshot_id: checkpoint.snapshotId,
    fetched_at: checkpoint.fetchedAt,
    position: checkpoint.position,
    timeline: checkpoint.timeline.map(toReplayTimelineItemResponseDto),
    status: checkpoint.status,
    alerts: [...toReplayAlertsResponseDto(checkpoint.alerts, containerNumber)],
    eta: toTrackingOperationalEtaResponseDto(checkpoint.eta),
    diff_from_previous: toTrackingTimeTravelDiffResponseDto(checkpoint.diffFromPrevious),
    debug_available: true,
  }
}

export function toTrackingTimeTravelResponseDto(
  replay: TrackingTimeTravelResult,
): TrackingTimeTravelResponseDto {
  return {
    container_id: replay.containerId,
    container_number: replay.containerNumber,
    reference_now: replay.referenceNow,
    selected_snapshot_id: replay.selectedSnapshotId,
    sync_count: replay.syncCount,
    syncs: replay.syncs.map((checkpoint) =>
      toTrackingTimeTravelCheckpointResponseDto(checkpoint, replay.containerNumber),
    ),
  }
}

export function toTrackingReplayDebugResponseDto(
  replay: TrackingReplayDebugResult,
): TrackingReplayDebugResponseDto {
  return {
    container_id: replay.containerId,
    container_number: replay.containerNumber,
    snapshot_id: replay.snapshotId,
    fetched_at: replay.fetchedAt,
    position: replay.position,
    reference_now: replay.referenceNow,
    total_observations: replay.totalObservations,
    total_steps: replay.totalSteps,
    steps: replay.steps.map((step) => toReplayStepResponseDto(step, replay.containerNumber)),
    checkpoint: toTrackingTimeTravelCheckpointResponseDto(
      replay.checkpoint,
      replay.containerNumber,
    ),
  }
}
