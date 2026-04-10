import { suppressSupersededObservationsForProjection } from '~/modules/tracking/application/projection/tracking.observation-visibility.readmodel'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import { computeFingerprint } from '~/modules/tracking/domain/identity/fingerprint'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { deriveAlertTransitions } from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { resolveAlertLifecycleState } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { diffObservations } from '~/modules/tracking/features/observation/application/orchestration/diffObservations'
import { normalizeSnapshot } from '~/modules/tracking/features/observation/application/orchestration/normalizeSnapshot'
import { toTrackingObservationProjections } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import {
  MAX_TRACKING_REPLAY_STEPS,
  type RunTrackingReplayCommand,
  type TrackingReplayRunCheckpoint,
  type TrackingReplayRunResult,
  type TrackingReplaySeries,
  type TrackingReplayStage,
  type TrackingReplayState,
  type TrackingReplayStep,
  TrackingReplayStepLimitError,
} from '~/modules/tracking/features/replay/application/tracking.replay.types'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import {
  deriveTimelineWithSeriesReadModel,
  type TrackingTimelineItem,
} from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { Instant } from '~/shared/time/instant'

function compareSnapshotsChronologically(a: Snapshot, b: Snapshot): number {
  const fetchedAtCompare = a.fetched_at.localeCompare(b.fetched_at)
  if (fetchedAtCompare !== 0) return fetchedAtCompare
  return a.id.localeCompare(b.id)
}

function toReplayCreatedAt(referenceIso: string, sequence: number): string {
  try {
    return Instant.fromEpochMs(Instant.fromIso(referenceIso).toEpochMs() + sequence).toIsoString()
  } catch {
    return referenceIso
  }
}

function resolveReplayContainerNumber(observations: readonly Observation[]): string | null {
  const firstWithNumber = observations.find(
    (observation) => observation.container_number.trim().length > 0,
  )
  return firstWithNumber?.container_number ?? null
}

function buildReplaySeries(
  timeline: readonly TrackingTimelineItem[],
): readonly TrackingReplaySeries[] {
  return timeline.flatMap((item) => {
    const seriesHistory = item.seriesHistory
    if (!seriesHistory || seriesHistory.classified.length === 0) return []

    return [
      {
        key: item.id,
        primary: {
          id: item.id,
          type: item.type,
          eventTime: item.eventTime,
          eventTimeType: item.eventTimeType,
        },
        hasActualConflict: seriesHistory.hasActualConflict,
        items: seriesHistory.classified.map((seriesItem) => ({
          id: seriesItem.id,
          type: seriesItem.type,
          eventTime: seriesItem.event_time,
          eventTimeType: seriesItem.event_time_type,
          createdAt: seriesItem.created_at,
          seriesLabel: seriesItem.seriesLabel,
          ...(seriesItem.vesselName === undefined ? {} : { vesselName: seriesItem.vesselName }),
          ...(seriesItem.voyage === undefined ? {} : { voyage: seriesItem.voyage }),
          ...(seriesItem.changeKind === undefined ? {} : { changeKind: seriesItem.changeKind }),
        })),
      },
    ]
  })
}

function applyReplayAlertTransitions(
  existingAlerts: readonly TrackingAlert[],
  newAlerts: readonly TrackingAlert[],
  autoResolutions: readonly {
    readonly alertId: string
    readonly reason: 'condition_cleared' | 'terminal_state'
  }[],
  resolvedAt: string,
): readonly TrackingAlert[] {
  if (newAlerts.length === 0 && autoResolutions.length === 0) return existingAlerts

  const alertsById = new Map(existingAlerts.map((alert) => [alert.id, alert] as const))

  for (const alert of newAlerts) {
    alertsById.set(alert.id, alert)
  }

  for (const resolution of autoResolutions) {
    const existing = alertsById.get(resolution.alertId)
    if (!existing) continue
    if (resolveAlertLifecycleState(existing) !== 'ACTIVE') continue

    alertsById.set(resolution.alertId, {
      ...existing,
      lifecycle_state: 'AUTO_RESOLVED',
      resolved_at: resolvedAt,
      resolved_reason: resolution.reason,
      acked_at: null,
      acked_by: null,
      acked_source: null,
    })
  }

  return [...alertsById.values()]
}

function toReplayAlertId(
  sequence: number,
  alertIndex: number,
  alertFingerprint: string | null,
): string {
  if (typeof alertFingerprint === 'string' && alertFingerprint.trim().length > 0) {
    return `replay-alert-${alertFingerprint}`
  }
  return `replay-alert-${sequence}-${alertIndex}`
}

function toReplayState(
  observations: readonly Observation[],
  alerts: readonly TrackingAlert[],
  containerId: string,
  containerNumber: string | null,
  now: Instant,
): TrackingReplayState {
  const resolvedContainerNumber = containerNumber ?? 'UNKNOWN'
  const projectionObservations = suppressSupersededObservationsForProjection(observations)
  const timelineDomain = deriveTimeline(
    containerId,
    resolvedContainerNumber,
    projectionObservations,
    now,
  )
  const status = deriveStatus(timelineDomain)
  const timeline = deriveTimelineWithSeriesReadModel(
    toTrackingObservationProjections(projectionObservations),
    now,
  )
  const series = buildReplaySeries(timeline)
  const activeAlerts = alerts.filter((alert) => resolveAlertLifecycleState(alert) === 'ACTIVE')

  return {
    observations: [...observations],
    series,
    timeline,
    status,
    alerts: activeAlerts,
  }
}

function pushReplayStep(command: {
  readonly steps: TrackingReplayStep[]
  readonly containerId: string
  readonly containerNumber: string | null
  readonly observations: readonly Observation[]
  readonly alerts: readonly TrackingAlert[]
  readonly now: Instant
  readonly stage: TrackingReplayStage
  readonly timestamp: string
  readonly snapshotId: string | null
  readonly observationId: string | null
  readonly input: unknown
  readonly output: unknown
}): void {
  const nextStepIndex = command.steps.length + 1
  if (nextStepIndex > MAX_TRACKING_REPLAY_STEPS) {
    throw new TrackingReplayStepLimitError(
      `Tracking replay exceeded max steps (${MAX_TRACKING_REPLAY_STEPS})`,
    )
  }

  command.steps.push({
    stepIndex: nextStepIndex,
    snapshotId: command.snapshotId,
    observationId: command.observationId,
    stage: command.stage,
    input: command.input,
    output: command.output,
    timestamp: command.timestamp,
    state: toReplayState(
      command.observations,
      command.alerts,
      command.containerId,
      command.containerNumber,
      command.now,
    ),
  })
}

function buildCheckpoint(command: {
  readonly containerId: string
  readonly snapshotId: string
  readonly fetchedAt: string
  readonly position: number
  readonly observations: readonly Observation[]
  readonly alerts: readonly TrackingAlert[]
}): TrackingReplayRunCheckpoint {
  const now = Instant.fromIso(command.fetchedAt)
  const containerNumber = resolveReplayContainerNumber(command.observations)

  return {
    snapshotId: command.snapshotId,
    fetchedAt: command.fetchedAt,
    position: command.position,
    containerNumber,
    state: toReplayState(
      command.observations,
      command.alerts,
      command.containerId,
      containerNumber,
      now,
    ),
  }
}

export async function runTrackingReplay(
  deps: TrackingUseCasesDeps,
  command: RunTrackingReplayCommand,
): Promise<TrackingReplayRunResult> {
  const referenceNow = command.now ?? Instant.now()
  const recordSteps = command.recordSteps ?? true
  const snapshots = [
    ...(await deps.snapshotRepository.findAllByContainerId(command.containerId)),
  ].sort(compareSnapshotsChronologically)
  const steps: TrackingReplayStep[] = []
  const checkpoints: TrackingReplayRunCheckpoint[] = []
  const observations: Observation[] = []
  let alerts: readonly TrackingAlert[] = []
  let observationSequence = 0
  let replayAlertSequence = 0

  for (const snapshot of snapshots) {
    const snapshotNow = Instant.fromIso(snapshot.fetched_at)
    const drafts = normalizeSnapshot(snapshot)
    const containerNumber =
      resolveReplayContainerNumber(observations) ?? drafts[0]?.container_number ?? null

    if (recordSteps) {
      pushReplayStep({
        steps,
        containerId: command.containerId,
        containerNumber,
        observations,
        alerts,
        now: snapshotNow,
        stage: 'SNAPSHOT',
        timestamp: snapshot.fetched_at,
        snapshotId: snapshot.id,
        observationId: null,
        input: {
          snapshot,
        },
        output: {
          drafts,
        },
      })
    }

    const existingFingerprints = new Set(observations.map((observation) => observation.fingerprint))
    const newObservations = diffObservations(existingFingerprints, drafts, command.containerId)
    const newObservationsByFingerprint = new Map(
      newObservations.map((observation) => [observation.fingerprint, observation] as const),
    )
    const seenInSnapshot = new Set<string>()

    for (const draft of drafts) {
      const fingerprint = computeFingerprint(draft)
      const isDuplicateFromHistory = existingFingerprints.has(fingerprint)
      const isDuplicateInSnapshot = seenInSnapshot.has(fingerprint)
      let duplicateReason: 'existing_observation' | 'duplicate_in_snapshot' | null = null
      if (isDuplicateFromHistory) {
        duplicateReason = 'existing_observation'
      } else if (isDuplicateInSnapshot) {
        duplicateReason = 'duplicate_in_snapshot'
      }
      seenInSnapshot.add(fingerprint)

      let insertedObservation: Observation | null = null
      if (duplicateReason === null) {
        const newObservation = newObservationsByFingerprint.get(fingerprint)
        if (newObservation) {
          observationSequence += 1
          insertedObservation = {
            ...newObservation,
            id: `replay-observation-${fingerprint}`,
            created_at: toReplayCreatedAt(snapshot.fetched_at, observationSequence),
          }
          observations.push(insertedObservation)
        }
      }

      const containerNumberAfterObservation =
        resolveReplayContainerNumber(observations) ?? containerNumber
      const currentTimeline = deriveTimeline(
        command.containerId,
        containerNumberAfterObservation ?? 'UNKNOWN',
        observations,
        snapshotNow,
      )
      const currentStatus = deriveStatus(currentTimeline)
      const alertTransitions = deriveAlertTransitions(
        currentTimeline,
        currentStatus,
        alerts,
        false,
        snapshotNow,
      )
      const createdAlerts = alertTransitions.newAlerts.map((alert, alertIndex) => ({
        ...alert,
        id: toReplayAlertId(++replayAlertSequence, alertIndex, alert.alert_fingerprint),
      }))
      alerts = applyReplayAlertTransitions(
        alerts,
        createdAlerts,
        alertTransitions.monitoringAutoResolutions,
        snapshotNow.toIsoString(),
      )

      if (recordSteps) {
        const currentState = toReplayState(
          observations,
          alerts,
          command.containerId,
          containerNumberAfterObservation,
          snapshotNow,
        )

        pushReplayStep({
          steps,
          containerId: command.containerId,
          containerNumber: containerNumberAfterObservation,
          observations,
          alerts,
          now: snapshotNow,
          stage: 'OBSERVATION',
          timestamp: snapshot.fetched_at,
          snapshotId: snapshot.id,
          observationId: insertedObservation?.id ?? null,
          input: {
            draft,
            fingerprint,
          },
          output:
            insertedObservation === null
              ? {
                  kind: 'discarded',
                  fingerprint,
                  reason: duplicateReason,
                }
              : {
                  kind: 'persisted',
                  observation: insertedObservation,
                },
        })
        pushReplayStep({
          steps,
          containerId: command.containerId,
          containerNumber: containerNumberAfterObservation,
          observations,
          alerts,
          now: snapshotNow,
          stage: 'SERIES',
          timestamp: snapshot.fetched_at,
          snapshotId: snapshot.id,
          observationId: insertedObservation?.id ?? null,
          input: {
            observationId: insertedObservation?.id ?? null,
            fingerprint,
          },
          output: currentState.series,
        })
        pushReplayStep({
          steps,
          containerId: command.containerId,
          containerNumber: containerNumberAfterObservation,
          observations,
          alerts,
          now: snapshotNow,
          stage: 'TIMELINE',
          timestamp: snapshot.fetched_at,
          snapshotId: snapshot.id,
          observationId: insertedObservation?.id ?? null,
          input: {
            observationId: insertedObservation?.id ?? null,
          },
          output: currentState.timeline,
        })
        pushReplayStep({
          steps,
          containerId: command.containerId,
          containerNumber: containerNumberAfterObservation,
          observations,
          alerts,
          now: snapshotNow,
          stage: 'STATUS',
          timestamp: snapshot.fetched_at,
          snapshotId: snapshot.id,
          observationId: insertedObservation?.id ?? null,
          input: {
            observationId: insertedObservation?.id ?? null,
          },
          output: currentState.status,
        })
        pushReplayStep({
          steps,
          containerId: command.containerId,
          containerNumber: containerNumberAfterObservation,
          observations,
          alerts,
          now: snapshotNow,
          stage: 'ALERT',
          timestamp: snapshot.fetched_at,
          snapshotId: snapshot.id,
          observationId: insertedObservation?.id ?? null,
          input: {
            observationId: insertedObservation?.id ?? null,
          },
          output: {
            newAlerts: createdAlerts,
            autoResolutions: alertTransitions.monitoringAutoResolutions,
            activeAlerts: currentState.alerts,
          },
        })
      }
    }

    checkpoints.push(
      buildCheckpoint({
        containerId: command.containerId,
        snapshotId: snapshot.id,
        fetchedAt: snapshot.fetched_at,
        position: checkpoints.length + 1,
        observations,
        alerts,
      }),
    )

    if (command.stopAfterSnapshotId === snapshot.id) {
      break
    }
  }

  const containerNumber = resolveReplayContainerNumber(observations)
  const finalState = toReplayState(
    observations,
    alerts,
    command.containerId,
    containerNumber,
    referenceNow,
  )

  return {
    containerId: command.containerId,
    containerNumber,
    referenceNow: referenceNow.toIsoString(),
    totalSnapshots: checkpoints.length,
    totalObservations: observations.length,
    totalSteps: steps.length,
    steps,
    checkpoints,
    finalState,
  }
}
