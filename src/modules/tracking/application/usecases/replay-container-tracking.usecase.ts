import { getContainerSummary } from '~/modules/tracking/application/usecases/get-container-summary.usecase'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import { computeFingerprint } from '~/modules/tracking/domain/identity/fingerprint'
import { deriveAlertTransitions } from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import { resolveAlertLifecycleState } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { diffObservations } from '~/modules/tracking/features/observation/application/orchestration/diffObservations'
import { normalizeSnapshot } from '~/modules/tracking/features/observation/application/orchestration/normalizeSnapshot'
import { toTrackingObservationProjections } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import {
  deriveTimelineWithSeriesReadModel,
  type TrackingTimelineItem,
} from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'

export const MAX_TRACKING_REPLAY_STEPS = 5000

export class TrackingReplayStepLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TrackingReplayStepLimitError'
  }
}

export type TrackingReplayStage =
  | 'SNAPSHOT'
  | 'OBSERVATION'
  | 'SERIES'
  | 'TIMELINE'
  | 'STATUS'
  | 'ALERT'

export type TrackingReplaySeries = {
  readonly key: string
  readonly primary: {
    readonly id: string
    readonly type: string
    readonly eventTime: string | null
    readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  }
  readonly hasActualConflict: boolean
  readonly items: readonly {
    readonly id: string
    readonly type: string
    readonly eventTime: string | null
    readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
    readonly createdAt: string
    readonly seriesLabel: string
  }[]
}

export type TrackingReplayState = {
  readonly observations: readonly Observation[]
  readonly series: readonly TrackingReplaySeries[]
  readonly timeline: readonly TrackingTimelineItem[]
  readonly status: ContainerStatus
  readonly alerts: readonly TrackingAlert[]
}

export type TrackingReplayStep = {
  readonly stepIndex: number
  readonly snapshotId: string | null
  readonly observationId: string | null
  readonly stage: TrackingReplayStage
  readonly input: unknown
  readonly output: unknown
  readonly timestamp: string
  readonly state: TrackingReplayState
}

export type TrackingReplayProductionComparison = {
  readonly timelineMatches: boolean
  readonly statusMatches: boolean
  readonly alertsMatch: boolean
}

export type ReplayContainerTrackingResult = {
  readonly containerId: string
  readonly containerNumber: string | null
  readonly referenceNow: string
  readonly totalSnapshots: number
  readonly totalObservations: number
  readonly totalSteps: number
  readonly steps: readonly TrackingReplayStep[]
  readonly finalTimeline: readonly TrackingTimelineItem[]
  readonly finalStatus: ContainerStatus
  readonly finalAlerts: readonly TrackingAlert[]
  readonly productionComparison: TrackingReplayProductionComparison
}

export type ReplayContainerTrackingCommand = {
  readonly containerId: string
  readonly now?: Date
}

function compareSnapshotsChronologically(
  a: { readonly fetched_at: string; readonly id: string },
  b: { readonly fetched_at: string; readonly id: string },
): number {
  const fetchedAtCompare = a.fetched_at.localeCompare(b.fetched_at)
  if (fetchedAtCompare !== 0) return fetchedAtCompare
  return a.id.localeCompare(b.id)
}

function toReplayCreatedAt(referenceIso: string, sequence: number): string {
  const referenceMs = Date.parse(referenceIso)
  if (Number.isNaN(referenceMs)) {
    return referenceIso
  }

  return new Date(referenceMs + sequence).toISOString()
}

function resolveReplayContainerNumber(observations: readonly Observation[]): string | null {
  const firstWithNumber = observations.find((observation) => observation.container_number.trim().length > 0)
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
          eventTime: item.eventTimeIso,
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

function toReplayAlertId(stepIndex: number, alertIndex: number, alertFingerprint: string | null): string {
  if (typeof alertFingerprint === 'string' && alertFingerprint.trim().length > 0) {
    return `replay-alert-${alertFingerprint}`
  }
  return `replay-alert-${stepIndex}-${alertIndex}`
}

function toReplayState(
  observations: readonly Observation[],
  alerts: readonly TrackingAlert[],
  containerId: string,
  containerNumber: string | null,
  now: Date,
): TrackingReplayState {
  const resolvedContainerNumber = containerNumber ?? 'UNKNOWN'
  const timelineDomain = deriveTimeline(containerId, resolvedContainerNumber, observations, now)
  const status = deriveStatus(timelineDomain)
  const timeline = deriveTimelineWithSeriesReadModel(toTrackingObservationProjections(observations), now)
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
  readonly now: Date
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

function compareAlertSets(
  replayAlerts: readonly TrackingAlert[],
  productionAlerts: readonly TrackingAlert[],
): boolean {
  const replayFingerprints = [...replayAlerts]
    .map((alert) => alert.alert_fingerprint ?? alert.type)
    .sort((left, right) => left.localeCompare(right))
  const productionFingerprints = [...productionAlerts]
    .map((alert) => alert.alert_fingerprint ?? alert.type)
    .sort((left, right) => left.localeCompare(right))

  return JSON.stringify(replayFingerprints) === JSON.stringify(productionFingerprints)
}

function normalizeTimelineForComparison(timeline: readonly TrackingTimelineItem[]): string {
  return JSON.stringify(
    timeline.map((item) => ({
      type: item.type,
      carrierLabel: item.carrierLabel ?? null,
      location: item.location ?? null,
      eventTimeIso: item.eventTimeIso,
      eventTimeType: item.eventTimeType,
      derivedState: item.derivedState,
      vesselName: item.vesselName ?? null,
      voyage: item.voyage ?? null,
      seriesHistory: item.seriesHistory
        ? {
            hasActualConflict: item.seriesHistory.hasActualConflict,
            classified: item.seriesHistory.classified.map((historyItem) => ({
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

export async function replayContainerTracking(
  deps: TrackingUseCasesDeps,
  command: ReplayContainerTrackingCommand,
): Promise<ReplayContainerTrackingResult> {
  const referenceNow = command.now ?? new Date()
  const snapshots = [...(await deps.snapshotRepository.findAllByContainerId(command.containerId))].sort(
    compareSnapshotsChronologically,
  )
  const steps: TrackingReplayStep[] = []
  const observations: Observation[] = []
  let alerts: readonly TrackingAlert[] = []
  let observationSequence = 0

  for (const snapshot of snapshots) {
    const snapshotNow = new Date(snapshot.fetched_at)
    const drafts = normalizeSnapshot(snapshot)
    const containerNumber = resolveReplayContainerNumber(observations) ?? drafts[0]?.container_number ?? null

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
      const duplicateReason =
        isDuplicateFromHistory === true
          ? 'existing_observation'
          : isDuplicateInSnapshot === true
            ? 'duplicate_in_snapshot'
            : null
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

      const containerNumberAfterObservation = resolveReplayContainerNumber(observations) ?? containerNumber
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
        id: toReplayAlertId(steps.length + 1, alertIndex, alert.alert_fingerprint),
      }))
      alerts = applyReplayAlertTransitions(
        alerts,
        createdAlerts,
        alertTransitions.monitoringAutoResolutions,
        snapshotNow.toISOString(),
      )
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

  const containerNumber = resolveReplayContainerNumber(observations)
  const finalContainerNumber = containerNumber ?? 'UNKNOWN'
  const finalTimelineDomain = deriveTimeline(
    command.containerId,
    finalContainerNumber,
    observations,
    referenceNow,
  )
  const finalStatus = deriveStatus(finalTimelineDomain)
  const finalAlertTransitions = deriveAlertTransitions(
    finalTimelineDomain,
    finalStatus,
    alerts,
    false,
    referenceNow,
  )
  const finalDerivedAlerts = finalAlertTransitions.newAlerts.map((alert, alertIndex) => ({
    ...alert,
    id: toReplayAlertId(steps.length + 1, alertIndex, alert.alert_fingerprint),
  }))
  const finalAlerts = applyReplayAlertTransitions(
    alerts,
    finalDerivedAlerts,
    finalAlertTransitions.monitoringAutoResolutions,
    referenceNow.toISOString(),
  )
  const finalState = toReplayState(
    observations,
    finalAlerts,
    command.containerId,
    containerNumber,
    referenceNow,
  )

  const productionSummary =
    containerNumber === null
      ? null
      : await getContainerSummary(deps, {
          containerId: command.containerId,
          containerNumber,
          now: referenceNow,
        })
  const productionTimeline =
    productionSummary === null
      ? []
      : deriveTimelineWithSeriesReadModel(
          toTrackingObservationProjections(productionSummary.observations),
          referenceNow,
        )
  const productionComparison: TrackingReplayProductionComparison = {
    timelineMatches:
      normalizeTimelineForComparison(finalState.timeline) ===
      normalizeTimelineForComparison(productionTimeline),
    statusMatches: finalState.status === (productionSummary?.status ?? finalState.status),
    alertsMatch:
      productionSummary === null ? finalState.alerts.length === 0 : compareAlertSets(finalState.alerts, productionSummary.alerts),
  }

  return {
    containerId: command.containerId,
    containerNumber,
    referenceNow: referenceNow.toISOString(),
    totalSnapshots: snapshots.length,
    totalObservations: observations.length,
    totalSteps: steps.length,
    steps,
    finalTimeline: finalState.timeline,
    finalStatus: finalState.status,
    finalAlerts: finalState.alerts,
    productionComparison,
  }
}
