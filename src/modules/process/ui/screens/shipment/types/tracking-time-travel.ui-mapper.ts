import { toAlertDisplayVMs } from '~/modules/process/ui/mappers/trackingAlert.ui-mapper'
import {
  toTrackingStatusCode,
  trackingStatusToVariant,
} from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type {
  TrackingReplayDebugStateVM,
  TrackingReplayDebugStepVM,
  TrackingReplayDebugVM,
  TrackingTimeTravelDiffVM,
  TrackingTimeTravelEtaVM,
  TrackingTimeTravelSyncVM,
  TrackingTimeTravelVM,
} from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import type {
  TrackingReplayDebugResponseDto,
  TrackingTimeTravelCheckpointResponseDto,
  TrackingTimeTravelDiffResponseDto,
  TrackingTimeTravelResponseDto,
} from '~/modules/tracking/interface/http/tracking.schemas'
import { formatDateForLocale } from '~/shared/utils/formatDate'

function toTimelineItem(
  item: TrackingTimeTravelCheckpointResponseDto['timeline'][number],
): TrackingTimelineItem {
  return {
    id: item.id,
    type: item.type,
    carrierLabel: item.carrier_label ?? undefined,
    location: item.location ?? undefined,
    eventTimeIso: item.event_time_iso,
    eventTimeType: item.event_time_type,
    derivedState: item.derived_state,
    vesselName: item.vessel_name,
    voyage: item.voyage,
    seriesHistory: item.series_history
      ? {
          hasActualConflict: item.series_history.has_actual_conflict,
          classified: item.series_history.classified.map((seriesItem) => ({
            id: seriesItem.id,
            type: seriesItem.type,
            event_time: seriesItem.event_time,
            event_time_type: seriesItem.event_time_type,
            created_at: seriesItem.created_at,
            seriesLabel: seriesItem.series_label,
          })),
        }
      : undefined,
  }
}

function toEtaTone(
  state: 'ACTUAL' | 'ACTIVE_EXPECTED' | 'EXPIRED_EXPECTED',
): 'positive' | 'informative' | 'warning' {
  switch (state) {
    case 'ACTUAL':
      return 'positive'
    case 'ACTIVE_EXPECTED':
      return 'informative'
    case 'EXPIRED_EXPECTED':
      return 'warning'
  }
}

function toEtaVm(
  eta: TrackingTimeTravelCheckpointResponseDto['eta'],
  locale: string,
): TrackingTimeTravelEtaVM {
  if (!eta) return null

  return {
    date: formatDateForLocale(eta.event_time, locale),
    state: eta.state,
    tone: toEtaTone(eta.state),
    type: eta.type,
  }
}

function toDiffVm(
  diff: TrackingTimeTravelDiffResponseDto,
  locale: string,
): TrackingTimeTravelDiffVM {
  if (diff.kind === 'initial') {
    return {
      kind: 'initial',
    }
  }

  return {
    kind: 'comparison',
    statusChanged: diff.status_changed,
    previousStatusCode: toTrackingStatusCode(diff.previous_status),
    currentStatusCode: toTrackingStatusCode(diff.current_status),
    timelineChanged: diff.timeline_changed,
    addedTimelineCount: diff.added_timeline_item_ids.length,
    removedTimelineCount: diff.removed_timeline_item_ids.length,
    alertsChanged: diff.alerts_changed,
    newAlertsCount: diff.new_alert_fingerprints.length,
    resolvedAlertsCount: diff.resolved_alert_fingerprints.length,
    etaChanged: diff.eta_changed,
    previousEta: toEtaVm(diff.previous_eta, locale),
    currentEta: toEtaVm(diff.current_eta, locale),
    actualConflictAppeared: diff.actual_conflict_appeared,
    actualConflictResolved: diff.actual_conflict_resolved,
  }
}

function toSyncVm(
  checkpoint: TrackingTimeTravelCheckpointResponseDto,
  locale: string,
): TrackingTimeTravelSyncVM {
  const statusCode = toTrackingStatusCode(checkpoint.status)

  return {
    snapshotId: checkpoint.snapshot_id,
    fetchedAtIso: checkpoint.fetched_at,
    position: checkpoint.position,
    statusCode,
    statusVariant: trackingStatusToVariant(statusCode),
    timeline: checkpoint.timeline.map(toTimelineItem),
    alerts: toAlertDisplayVMs(checkpoint.alerts, locale),
    eta: toEtaVm(checkpoint.eta, locale),
    diff: toDiffVm(checkpoint.diff_from_previous, locale),
    debugAvailable: checkpoint.debug_available,
  }
}

function toDebugStateVm(
  state: TrackingReplayDebugResponseDto['steps'][number]['state'],
  locale: string,
): TrackingReplayDebugStateVM {
  return {
    observations: state.observations.map((observation) => ({
      id: observation.id,
      fingerprint: observation.fingerprint,
      type: observation.type,
      carrierLabel: observation.carrier_label,
      eventTime: observation.event_time,
      eventTimeType: observation.event_time_type,
      locationCode: observation.location_code,
      locationDisplay: observation.location_display,
      vesselName: observation.vessel_name,
      voyage: observation.voyage,
      isEmpty: observation.is_empty,
      confidence: observation.confidence,
      provider: observation.provider,
      createdFromSnapshotId: observation.created_from_snapshot_id,
      retroactive: observation.retroactive,
      createdAt: observation.created_at,
    })),
    series: state.series.map((series) => ({
      key: series.key,
      primary: {
        id: series.primary.id,
        type: series.primary.type,
        eventTime: series.primary.event_time,
        eventTimeType: series.primary.event_time_type,
      },
      hasActualConflict: series.has_actual_conflict,
      items: series.items.map((item) => ({
        id: item.id,
        type: item.type,
        eventTime: item.event_time,
        eventTimeType: item.event_time_type,
        createdAt: item.created_at,
        seriesLabel: item.series_label,
      })),
    })),
    timeline: state.timeline.map(toTimelineItem),
    status: toTrackingStatusCode(state.status),
    alerts: toAlertDisplayVMs(state.alerts, locale),
  }
}

function toDebugStepVm(
  step: TrackingReplayDebugResponseDto['steps'][number],
  locale: string,
): TrackingReplayDebugStepVM {
  return {
    stepIndex: step.step_index,
    snapshotId: step.snapshot_id,
    observationId: step.observation_id,
    stage: step.stage,
    input: step.input,
    output: step.output,
    timestampIso: step.timestamp,
    state: toDebugStateVm(step.state, locale),
  }
}

export function toTrackingTimeTravelVm(
  response: TrackingTimeTravelResponseDto,
  locale: string,
): TrackingTimeTravelVM {
  return {
    containerId: response.container_id,
    containerNumber: response.container_number,
    referenceNowIso: response.reference_now,
    selectedSnapshotId: response.selected_snapshot_id,
    syncCount: response.sync_count,
    syncs: response.syncs.map((sync) => toSyncVm(sync, locale)),
  }
}

export function toTrackingReplayDebugVm(
  response: TrackingReplayDebugResponseDto,
  locale: string,
): TrackingReplayDebugVM {
  return {
    containerId: response.container_id,
    containerNumber: response.container_number,
    snapshotId: response.snapshot_id,
    fetchedAtIso: response.fetched_at,
    position: response.position,
    referenceNowIso: response.reference_now,
    totalObservations: response.total_observations,
    totalSteps: response.total_steps,
    steps: response.steps.map((step) => toDebugStepVm(step, locale)),
    checkpoint: toSyncVm(response.checkpoint, locale),
  }
}
