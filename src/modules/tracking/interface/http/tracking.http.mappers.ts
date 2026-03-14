import type {
  ReplayContainerTrackingResult,
  TrackingReplaySeries,
  TrackingReplayState,
  TrackingReplayStep,
} from '~/modules/tracking/application/usecases/replay-container-tracking.usecase'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingAlertDisplayReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.alert-display.readmodel'
import { toTrackingAlertDisplayReadModels } from '~/modules/tracking/features/alerts/application/projection/tracking.alert-display.readmodel'
import { toTrackingAlertMessageContract } from '~/modules/tracking/features/alerts/application/projection/tracking.alert-message-contract.mapper'
import { resolveAlertLifecycleState } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import type {
  AlertResponseDto,
  SnapshotResponseDto,
  TrackingReplayResultResponseDto,
  TrackingReplayStepSnapshotResponseDto,
  TrackingReplayStepsResponseDto,
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

export function toTrackingReplayResultResponseDto(
  replay: ReplayContainerTrackingResult,
): TrackingReplayResultResponseDto {
  return {
    container_id: replay.containerId,
    container_number: replay.containerNumber,
    reference_now: replay.referenceNow,
    total_snapshots: replay.totalSnapshots,
    total_observations: replay.totalObservations,
    total_steps: replay.totalSteps,
    steps: replay.steps.map((step) => toReplayStepResponseDto(step, replay.containerNumber)),
    final_timeline: replay.finalTimeline.map(toReplayTimelineItemResponseDto),
    final_status: replay.finalStatus,
    final_alerts: [...toReplayAlertsResponseDto(replay.finalAlerts, replay.containerNumber)],
    production_comparison: {
      timeline_matches: replay.productionComparison.timelineMatches,
      status_matches: replay.productionComparison.statusMatches,
      alerts_match: replay.productionComparison.alertsMatch,
    },
  }
}

export function toTrackingReplayStepsResponseDto(
  replay: ReplayContainerTrackingResult,
  steps: readonly TrackingReplayStep[],
  nextCursor: number | null,
): TrackingReplayStepsResponseDto {
  return {
    container_id: replay.containerId,
    total_steps: replay.totalSteps,
    next_cursor: nextCursor,
    steps: steps.map((step) => toReplayStepResponseDto(step, replay.containerNumber)),
  }
}

export function toTrackingReplayStepSnapshotResponseDto(
  replay: ReplayContainerTrackingResult,
  step: TrackingReplayStep,
): TrackingReplayStepSnapshotResponseDto {
  return {
    container_id: replay.containerId,
    step_index: step.stepIndex,
    step: toReplayStepResponseDto(step, replay.containerNumber),
  }
}
