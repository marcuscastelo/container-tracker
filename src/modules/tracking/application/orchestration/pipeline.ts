import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import {
  noopTrackingContainmentRepository,
  type TrackingContainmentRepository,
} from '~/modules/tracking/application/ports/tracking.containment.repository'
import type { ObservationRepository } from '~/modules/tracking/application/ports/tracking.observation.repository'
import type { SnapshotRepository } from '~/modules/tracking/application/ports/tracking.snapshot.repository'
import {
  noopTrackingValidationLifecycleRepository,
  type TrackingValidationLifecycleRepository,
} from '~/modules/tracking/application/ports/tracking.validation-lifecycle.repository'
import { suppressSupersededObservationsForProjection } from '~/modules/tracking/application/projection/tracking.observation-visibility.readmodel'
import {
  derivePlannedTransshipmentAlertTransitions,
  toTransshipmentSemanticKey,
} from '~/modules/tracking/application/projection/tracking.planned-transshipment.readmodel'
import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import {
  deriveAlertTransitions,
  deriveTransshipment,
  deriveTransshipmentOccurrences,
} from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import type {
  NewTrackingAlert,
  TrackingAlert,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { detectContainerReuseAfterCompletion } from '~/modules/tracking/features/containment/domain/services/detectContainerReuseAfterCompletion'
import { diffObservations } from '~/modules/tracking/features/observation/application/orchestration/diffObservations'
import { normalizeSnapshot } from '~/modules/tracking/features/observation/application/orchestration/normalizeSnapshot'
import { toTrackingObservationProjections } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import type {
  NewObservation,
  Observation,
} from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import { deriveTimelineWithSeriesReadModel } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import type { Timeline } from '~/modules/tracking/features/timeline/domain/model/timeline'
import {
  createTrackingValidationContext,
  deriveTrackingValidationProjection,
} from '~/modules/tracking/features/validation/application/projection/trackingValidation.projection'
import type { TrackingValidationLifecycleState } from '~/modules/tracking/features/validation/domain/model/trackingValidationLifecycle'
import type { TrackingValidationContainerSummary } from '~/modules/tracking/features/validation/domain/model/trackingValidationSummary'
import { deriveTrackingValidationLifecycleTransitions } from '~/modules/tracking/features/validation/domain/services/deriveTrackingValidationLifecycleTransitions'
import { InfrastructureError } from '~/shared/errors/httpErrors'
import { systemClock } from '~/shared/time/clock'
import { Instant } from '~/shared/time/instant'

/**
 * Result of processing a single snapshot through the pipeline.
 */
export type PipelineResult = {
  /** Observations that were newly persisted */
  readonly newObservations: readonly Observation[]
  /** Alerts that were newly created */
  readonly newAlerts: readonly TrackingAlert[]
  /** Current derived timeline */
  readonly timeline: Timeline
  /** Current derived status */
  readonly status: ContainerStatus
  /** Transshipment info */
  readonly transshipment: TransshipmentInfo
  /** Minimal canonical tracking validation summary */
  readonly trackingValidation: TrackingValidationContainerSummary
}

/**
 * Pipeline dependencies — injected repositories.
 */
type PipelineDeps = {
  readonly snapshotRepository: SnapshotRepository
  readonly observationRepository: ObservationRepository
  readonly trackingAlertRepository: TrackingAlertRepository
  readonly trackingContainmentRepository?: TrackingContainmentRepository
  readonly trackingValidationLifecycleRepository?: TrackingValidationLifecycleRepository
}

function toContainmentCandidateObservations(command: {
  readonly existingObservations: readonly Observation[]
  readonly newObservations: readonly NewObservation[]
  readonly snapshot: Snapshot
}) {
  const baseEpochMs = Instant.fromIso(command.snapshot.fetched_at).toEpochMs()
  const candidateNewObservations = command.newObservations.map((observation, index) => ({
    entityId: `candidate:${observation.fingerprint}:${index}`,
    fingerprint: observation.fingerprint,
    type: observation.type,
    event_time: observation.event_time,
    event_time_type: observation.event_time_type,
    created_at: Instant.fromEpochMs(baseEpochMs + index).toIsoString(),
    is_empty: observation.is_empty,
  }))

  const existingObservations = command.existingObservations.map((observation) => ({
    entityId: observation.id,
    fingerprint: observation.fingerprint,
    type: observation.type,
    event_time: observation.event_time,
    event_time_type: observation.event_time_type,
    created_at: observation.created_at,
    is_empty: observation.is_empty,
  }))

  return [...existingObservations, ...candidateNewObservations]
}

async function loadActiveTrackingContainment(command: {
  readonly repository: TrackingContainmentRepository
  readonly containerId: string
  readonly containerNumber: string
}) {
  try {
    return await command.repository.findActiveByContainerId(command.containerId)
  } catch (error) {
    if (!(error instanceof InfrastructureError)) {
      throw error
    }

    console.error('tracking.processSnapshot.containment_unavailable', {
      containerId: command.containerId,
      containerNumber: command.containerNumber,
      operation: 'findActiveByContainerId',
      error: error.message,
    })

    return null
  }
}

async function activateTrackingContainment(command: {
  readonly repository: TrackingContainmentRepository
  readonly containerId: string
  readonly containerNumber: string
  readonly snapshot: Snapshot
  readonly detection: ReturnType<typeof detectContainerReuseAfterCompletion>
}) {
  if (command.detection === null) {
    return
  }

  try {
    await command.repository.activate({
      containerId: command.containerId,
      provider: command.snapshot.provider,
      snapshotId: command.snapshot.id,
      activatedAt: command.snapshot.fetched_at,
      stateFingerprint: command.detection.stateFingerprint,
      evidenceSummary: command.detection.evidenceSummary,
    })
  } catch (error) {
    if (!(error instanceof InfrastructureError)) {
      throw error
    }

    console.error('tracking.processSnapshot.containment_unavailable', {
      containerId: command.containerId,
      containerNumber: command.containerNumber,
      operation: 'activate',
      error: error.message,
    })
  }
}

async function derivePipelineState(command: {
  readonly deps: PipelineDeps
  readonly snapshot: Snapshot
  readonly containerId: string
  readonly containerNumber: string
  readonly allObservations: readonly Observation[]
  readonly isBackfill: boolean
  readonly allowAlertMutations: boolean
  readonly referenceNow: Instant
}) {
  const derivationNow = systemClock.now()
  const timeline = deriveTimeline(
    command.containerId,
    command.containerNumber,
    command.allObservations,
  )
  const status = deriveStatus(timeline)

  let newAlerts: readonly TrackingAlert[] = []
  if (command.allowAlertMutations) {
    const existingAlerts =
      await command.deps.trackingAlertRepository.findAlertDerivationStateByContainerId(
        command.containerId,
      )
    const alertTransitions = deriveAlertTransitions(
      timeline,
      status,
      existingAlerts,
      command.isBackfill,
      command.referenceNow,
    )
    const projectionObservations = suppressSupersededObservationsForProjection(
      command.allObservations,
    )
    const timelineItems = deriveTimelineWithSeriesReadModel(
      toTrackingObservationProjections(projectionObservations),
      derivationNow,
      { includeSeriesHistory: false },
    )
    const activeFactTransshipmentSemanticKeys = new Set(
      deriveTransshipmentOccurrences(timeline, derivationNow).map((occurrence) =>
        toTransshipmentSemanticKey({
          port: occurrence.port,
          fromVessel: occurrence.vesselFrom,
          toVessel: occurrence.vesselTo,
        }),
      ),
    )
    const plannedTransitions = derivePlannedTransshipmentAlertTransitions({
      timelineItems,
      observations: projectionObservations,
      existingAlerts,
      activeFactTransshipmentSemanticKeys,
      now: derivationNow,
    })
    const existingPlannedFingerprints = new Set(
      existingAlerts
        .filter((alert) => alert.type === 'PLANNED_TRANSSHIPMENT')
        .map((alert) => alert.alert_fingerprint)
        .filter((fingerprint): fingerprint is string => fingerprint !== null),
    )
    const newPlannedAlertDescriptors: readonly NewTrackingAlert[] = plannedTransitions.occurrences
      .filter((occurrence) => !existingPlannedFingerprints.has(occurrence.alertFingerprint))
      .map((occurrence) => ({
        lifecycle_state: 'ACTIVE',
        container_id: timeline.container_id,
        category: 'monitoring',
        type: 'PLANNED_TRANSSHIPMENT',
        severity: 'warning',
        message_key: 'alerts.plannedTransshipmentDetected',
        message_params: {
          port: occurrence.port,
          fromVessel: occurrence.fromVessel,
          toVessel: occurrence.toVessel,
        },
        detected_at: occurrence.detectedAt,
        triggered_at: derivationNow.toIsoString(),
        source_observation_fingerprints: [...occurrence.sourceObservationFingerprints],
        alert_fingerprint: occurrence.alertFingerprint,
        retroactive: false,
        provider: null,
        acked_at: null,
        acked_by: null,
        acked_source: null,
        resolved_at: null,
        resolved_reason: null,
      }))
    const newAlertDescriptors: readonly NewTrackingAlert[] = [
      ...alertTransitions.newAlerts,
      ...newPlannedAlertDescriptors,
    ]
    const allAutoResolutions = [
      ...alertTransitions.monitoringAutoResolutions,
      ...plannedTransitions.alertIdsToAutoResolve.map((alertId) => ({
        alertId,
        reason: 'condition_cleared' as const,
      })),
    ]

    if (allAutoResolutions.length > 0) {
      const reasonByAlertId = new Map(
        allAutoResolutions.map((entry) => [entry.alertId, entry.reason] as const),
      )
      const idsByReason = new Map<string, string[]>()
      for (const [alertId, reason] of reasonByAlertId) {
        const existing = idsByReason.get(reason)
        if (existing) {
          existing.push(alertId)
        } else {
          idsByReason.set(reason, [alertId])
        }
      }

      const resolvedAt = systemClock.now().toIsoString()
      for (const [reason, alertIds] of idsByReason) {
        if (reason === 'condition_cleared' || reason === 'terminal_state') {
          await command.deps.trackingAlertRepository.autoResolveMany({
            alertIds,
            resolvedAt,
            reason,
          })
        }
      }
    }

    if (newAlertDescriptors.length > 0) {
      newAlerts = await command.deps.trackingAlertRepository.insertMany(newAlertDescriptors)
    }
  }

  const transshipment = deriveTransshipment(timeline)
  const snapshotValidationNow = Instant.fromIso(command.snapshot.fetched_at)
  const validationTimeline = deriveTimeline(
    command.containerId,
    command.containerNumber,
    command.allObservations,
    snapshotValidationNow,
  )
  const validationStatus = deriveStatus(validationTimeline)
  const validationTransshipment = deriveTransshipment(validationTimeline)
  const trackingValidationProjection = deriveTrackingValidationProjection(
    createTrackingValidationContext({
      containerId: command.containerId,
      containerNumber: command.containerNumber,
      observations: command.allObservations,
      timeline: validationTimeline,
      status: validationStatus,
      transshipment: validationTransshipment,
      now: snapshotValidationNow,
    }),
  )

  return {
    timeline,
    status,
    transshipment,
    newAlerts,
    trackingValidation: trackingValidationProjection.summary,
    trackingValidationFindings: trackingValidationProjection.findings,
  }
}

async function loadTrackingValidationLifecycleStates(command: {
  readonly repository: TrackingValidationLifecycleRepository
  readonly containerId: string
  readonly containerNumber: string
}): Promise<readonly TrackingValidationLifecycleState[]> {
  try {
    return await command.repository.findActiveStatesByContainerId(command.containerId)
  } catch (error) {
    if (!(error instanceof InfrastructureError)) {
      throw error
    }

    console.error('tracking.processSnapshot.validation_lifecycle_unavailable', {
      containerId: command.containerId,
      containerNumber: command.containerNumber,
      operation: 'findActiveStatesByContainerId',
      error: error.message,
    })

    return []
  }
}

async function persistTrackingValidationLifecycleTransitions(command: {
  readonly repository: TrackingValidationLifecycleRepository
  readonly transitions: ReturnType<typeof deriveTrackingValidationLifecycleTransitions>
  readonly containerId: string
  readonly containerNumber: string
}): Promise<void> {
  if (command.transitions.length === 0) {
    return
  }

  try {
    await command.repository.insertMany(command.transitions)
  } catch (error) {
    if (!(error instanceof InfrastructureError)) {
      throw error
    }

    console.error('tracking.processSnapshot.validation_lifecycle_unavailable', {
      containerId: command.containerId,
      containerNumber: command.containerNumber,
      operation: 'insertMany',
      transitionCount: command.transitions.length,
      error: error.message,
    })
  }
}

/**
 * Process a snapshot through the full derivation pipeline.
 *
 * Pipeline flow (from master doc §4.1):
 *   1. Persist the snapshot (immutable, append-only)
 *   2. Normalize → ObservationDraft[]
 *   3. Diff against existing observations → NewObservation[]
 *   4. Persist new observations
 *   5. Derive Timeline
 *   6. Derive Status
 *   7. Derive Alerts
 *   8. Persist new alerts
 *
 * @param snapshot - The snapshot to process (already persisted or to be persisted)
 * @param containerId - UUID of the container entity
 * @param containerNumber - Container number (denormalized)
 * @param deps - Injected repositories
 * @param isBackfill - Whether this is a backfill/onboarding run
 * @returns PipelineResult with all derived data
 */
export async function processSnapshot(
  snapshot: Snapshot,
  containerId: string,
  containerNumber: string,
  deps: PipelineDeps,
  isBackfill: boolean = false,
  referenceNow: Instant = systemClock.now(),
): Promise<PipelineResult> {
  // Step 1: Snapshot is already persisted by the caller (or we persist it here)
  // The snapshot should already have an id at this point.

  const trackingContainmentRepository =
    deps.trackingContainmentRepository ?? noopTrackingContainmentRepository
  const activeContainment = await loadActiveTrackingContainment({
    repository: trackingContainmentRepository,
    containerId,
    containerNumber,
  })

  if (activeContainment !== null) {
    const allObservations = await deps.observationRepository.findAllByContainerId(containerId)
    const derivedState = await derivePipelineState({
      deps,
      snapshot,
      containerId,
      containerNumber,
      allObservations,
      isBackfill,
      allowAlertMutations: false,
      referenceNow,
    })
    const trackingValidationLifecycleRepository =
      deps.trackingValidationLifecycleRepository ?? noopTrackingValidationLifecycleRepository
    const existingValidationLifecycleStates = await loadTrackingValidationLifecycleStates({
      repository: trackingValidationLifecycleRepository,
      containerId,
      containerNumber,
    })
    const validationLifecycleTransitions = deriveTrackingValidationLifecycleTransitions({
      activeFindings: derivedState.trackingValidationFindings,
      existingActiveStates: existingValidationLifecycleStates,
      context: {
        containerId,
        provider: snapshot.provider,
        snapshotId: snapshot.id,
        occurredAt: snapshot.fetched_at,
      },
    })

    await persistTrackingValidationLifecycleTransitions({
      repository: trackingValidationLifecycleRepository,
      transitions: validationLifecycleTransitions,
      containerId,
      containerNumber,
    })

    return {
      newObservations: [],
      newAlerts: [],
      timeline: derivedState.timeline,
      status: derivedState.status,
      transshipment: derivedState.transshipment,
      trackingValidation: derivedState.trackingValidation,
    }
  }

  // Step 2: Normalize → ObservationDrafts
  const drafts = normalizeSnapshot(snapshot)

  // Step 3: Diff against existing fingerprints
  const existingFingerprints =
    await deps.observationRepository.findFingerprintsByContainerId(containerId)
  const newObsToInsert: readonly NewObservation[] = diffObservations(
    existingFingerprints,
    drafts,
    containerId,
  )
  const existingObservations = await deps.observationRepository.findAllByContainerId(containerId)
  const containmentDetection =
    newObsToInsert.length > 0
      ? detectContainerReuseAfterCompletion(
          toContainmentCandidateObservations({
            existingObservations,
            newObservations: newObsToInsert,
            snapshot,
          }),
        )
      : null

  if (containmentDetection !== null) {
    await activateTrackingContainment({
      repository: trackingContainmentRepository,
      containerId,
      containerNumber,
      snapshot,
      detection: containmentDetection,
    })

    const derivedState = await derivePipelineState({
      deps,
      snapshot,
      containerId,
      containerNumber,
      allObservations: existingObservations,
      isBackfill,
      allowAlertMutations: false,
      referenceNow,
    })
    const trackingValidationLifecycleRepository =
      deps.trackingValidationLifecycleRepository ?? noopTrackingValidationLifecycleRepository
    const existingValidationLifecycleStates = await loadTrackingValidationLifecycleStates({
      repository: trackingValidationLifecycleRepository,
      containerId,
      containerNumber,
    })
    const validationLifecycleTransitions = deriveTrackingValidationLifecycleTransitions({
      activeFindings: derivedState.trackingValidationFindings,
      existingActiveStates: existingValidationLifecycleStates,
      context: {
        containerId,
        provider: snapshot.provider,
        snapshotId: snapshot.id,
        occurredAt: snapshot.fetched_at,
      },
    })

    await persistTrackingValidationLifecycleTransitions({
      repository: trackingValidationLifecycleRepository,
      transitions: validationLifecycleTransitions,
      containerId,
      containerNumber,
    })

    return {
      newObservations: [],
      newAlerts: [],
      timeline: derivedState.timeline,
      status: derivedState.status,
      transshipment: derivedState.transshipment,
      trackingValidation: derivedState.trackingValidation,
    }
  }

  // Step 4: Persist new observations
  let newObservations: readonly Observation[] = []
  if (newObsToInsert.length > 0) {
    newObservations = await deps.observationRepository.insertMany(newObsToInsert)
  }

  // Step 5: Derive Timeline (from ALL observations, not just new ones)
  const allObservations = await deps.observationRepository.findAllByContainerId(containerId)
  const derivedState = await derivePipelineState({
    deps,
    snapshot,
    containerId,
    containerNumber,
    allObservations,
    isBackfill,
    allowAlertMutations: true,
    referenceNow,
  })
  const trackingValidationLifecycleRepository =
    deps.trackingValidationLifecycleRepository ?? noopTrackingValidationLifecycleRepository
  const existingValidationLifecycleStates = await loadTrackingValidationLifecycleStates({
    repository: trackingValidationLifecycleRepository,
    containerId,
    containerNumber,
  })
  const validationLifecycleTransitions = deriveTrackingValidationLifecycleTransitions({
    activeFindings: derivedState.trackingValidationFindings,
    existingActiveStates: existingValidationLifecycleStates,
    context: {
      containerId,
      provider: snapshot.provider,
      snapshotId: snapshot.id,
      occurredAt: snapshot.fetched_at,
    },
  })

  await persistTrackingValidationLifecycleTransitions({
    repository: trackingValidationLifecycleRepository,
    transitions: validationLifecycleTransitions,
    containerId,
    containerNumber,
  })

  return {
    newObservations,
    newAlerts: derivedState.newAlerts,
    timeline: derivedState.timeline,
    status: derivedState.status,
    transshipment: derivedState.transshipment,
    trackingValidation: derivedState.trackingValidation,
  }
}
