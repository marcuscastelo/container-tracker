import { suppressSupersededObservationsForProjection } from '~/modules/tracking/application/projection/tracking.observation-visibility.readmodel'
import { deriveTrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import { deriveTransshipment } from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import { toTrackingObservationProjections } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import type {
  TrackingReplayRunCheckpoint,
  TrackingReplayRunResult,
  TrackingTimeTravelCheckpoint,
  TrackingTimeTravelDiff,
  TrackingTimeTravelResult,
} from '~/modules/tracking/features/replay/application/tracking.replay.types'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { deriveTrackingValidationSummaryFromState } from '~/modules/tracking/features/validation/application/projection/trackingValidation.projection'
import { Instant } from '~/shared/time/instant'

type TrackingTimeTravelCheckpointBase = Omit<TrackingTimeTravelCheckpoint, 'diffFromPrevious'>

function normalizeTimelineForDiff(timeline: TrackingTimeTravelCheckpoint['timeline']): string {
  return JSON.stringify(
    timeline.map((item) => ({
      id: item.id,
      type: item.type,
      carrierLabel: item.carrierLabel ?? null,
      location: item.location ?? null,
      eventTime: item.eventTime,
      eventTimeType: item.eventTimeType,
      derivedState: item.derivedState,
      vesselName: item.vesselName ?? null,
      voyage: item.voyage ?? null,
      seriesHistory: item.seriesHistory
        ? {
            hasActualConflict: item.seriesHistory.hasActualConflict,
            classified: item.seriesHistory.classified.map((historyItem) => ({
              id: historyItem.id,
              type: historyItem.type,
              event_time: historyItem.event_time,
              event_time_type: historyItem.event_time_type,
              seriesLabel: historyItem.seriesLabel,
            })),
          }
        : null,
    })),
  )
}

function buildAlertFingerprint(alert: TrackingTimeTravelCheckpoint['alerts'][number]): string {
  if (typeof alert.alert_fingerprint === 'string' && alert.alert_fingerprint.trim().length > 0) {
    return alert.alert_fingerprint
  }
  return `${alert.type}:${alert.message_key}:${alert.triggered_at}`
}

function hasActualConflict(checkpoint: TrackingTimeTravelCheckpointBase): boolean {
  return checkpoint.timeline.some((item) => item.seriesHistory?.hasActualConflict === true)
}

function toIdSet(values: readonly string[]): ReadonlySet<string> {
  return new Set(values)
}

function diffIdLists(current: readonly string[], previous: readonly string[]) {
  const currentSet = toIdSet(current)
  const previousSet = toIdSet(previous)

  return {
    added: current.filter((id) => !previousSet.has(id)),
    removed: previous.filter((id) => !currentSet.has(id)),
  }
}

function buildCheckpointState(command: {
  readonly run: TrackingReplayRunResult
  readonly rawCheckpoint: TrackingReplayRunCheckpoint
  readonly isLatest: boolean
}): Omit<TrackingTimeTravelCheckpoint, 'diffFromPrevious'> {
  // Historical checkpoints should render the same canonical timeline contract used by
  // shipment detail. The latest checkpoint intentionally uses replay.finalState so the
  // selected default sync has exact semantic parity with live tracking for the same referenceNow.
  const effectiveNow = command.isLatest
    ? Instant.fromIso(command.run.referenceNow)
    : Instant.fromIso(command.rawCheckpoint.fetchedAt)
  const containerNumber =
    command.rawCheckpoint.containerNumber ?? command.run.containerNumber ?? 'UNKNOWN'
  const state = command.isLatest ? command.run.finalState : command.rawCheckpoint.state
  const projectionObservations = suppressSupersededObservationsForProjection(state.observations)
  const timelineDomain = deriveTimeline(
    command.run.containerId,
    containerNumber,
    projectionObservations,
    effectiveNow,
  )
  const transshipment = deriveTransshipment(timelineDomain)
  const operational = deriveTrackingOperationalSummary({
    observations: toTrackingObservationProjections(projectionObservations),
    status: state.status,
    transshipment,
    now: effectiveNow,
  })
  const trackingValidation = deriveTrackingValidationSummaryFromState({
    containerId: command.run.containerId,
    containerNumber,
    observations: projectionObservations,
    timeline: timelineDomain,
    status: state.status,
    transshipment,
    now: effectiveNow,
  })

  return {
    snapshotId: command.rawCheckpoint.snapshotId,
    fetchedAt: command.rawCheckpoint.fetchedAt,
    position: command.rawCheckpoint.position,
    timeline: state.timeline,
    status: state.status,
    alerts: state.alerts,
    eta: operational.eta,
    operational,
    trackingValidation,
    debugAvailable: true,
  }
}

function buildDiffFromPrevious(
  current: TrackingTimeTravelCheckpointBase,
  previous: TrackingTimeTravelCheckpointBase | null,
): TrackingTimeTravelDiff {
  // This diff is a replay/time-travel read-model concern for UI navigation. It is derived
  // in tracking application code and must not become a second canonical domain pipeline.
  if (previous === null) {
    return { kind: 'initial' }
  }

  const currentTimelineIds = current.timeline.map((item) => item.id)
  const previousTimelineIds = previous.timeline.map((item) => item.id)
  const timelineIdDiff = diffIdLists(currentTimelineIds, previousTimelineIds)

  const currentAlertFingerprints = current.alerts.map(buildAlertFingerprint)
  const previousAlertFingerprints = previous.alerts.map(buildAlertFingerprint)
  const alertDiff = diffIdLists(currentAlertFingerprints, previousAlertFingerprints)

  const previousEta = previous.eta
  const currentEta = current.eta
  const etaChanged = JSON.stringify(previousEta) !== JSON.stringify(currentEta)

  return {
    kind: 'comparison',
    statusChanged: current.status !== previous.status,
    previousStatus: previous.status,
    currentStatus: current.status,
    timelineChanged:
      normalizeTimelineForDiff(current.timeline) !== normalizeTimelineForDiff(previous.timeline),
    addedTimelineItemIds: timelineIdDiff.added,
    removedTimelineItemIds: timelineIdDiff.removed,
    alertsChanged: alertDiff.added.length > 0 || alertDiff.removed.length > 0,
    newAlertFingerprints: alertDiff.added,
    resolvedAlertFingerprints: alertDiff.removed,
    etaChanged,
    previousEta,
    currentEta,
    actualConflictAppeared: hasActualConflict(current) && !hasActualConflict(previous),
    actualConflictResolved: !hasActualConflict(current) && hasActualConflict(previous),
  }
}

export function buildTrackingTimeTravelReadModel(
  run: TrackingReplayRunResult,
): TrackingTimeTravelResult {
  const baseCheckpoints = run.checkpoints.map((rawCheckpoint, index, checkpoints) =>
    buildCheckpointState({
      run,
      rawCheckpoint,
      isLatest: index === checkpoints.length - 1,
    }),
  )

  const syncs = baseCheckpoints.map((checkpoint, index) => ({
    ...checkpoint,
    diffFromPrevious: buildDiffFromPrevious(checkpoint, baseCheckpoints[index - 1] ?? null),
  }))

  return {
    containerId: run.containerId,
    containerNumber: run.containerNumber,
    referenceNow: run.referenceNow,
    selectedSnapshotId: syncs[syncs.length - 1]?.snapshotId ?? null,
    syncCount: syncs.length,
    syncs,
  }
}
