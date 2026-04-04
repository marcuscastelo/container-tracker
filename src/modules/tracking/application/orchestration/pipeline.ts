import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { ObservationRepository } from '~/modules/tracking/application/ports/tracking.observation.repository'
import type { SnapshotRepository } from '~/modules/tracking/application/ports/tracking.snapshot.repository'
import {
  noopTrackingValidationLifecycleRepository,
  type TrackingValidationLifecycleRepository,
} from '~/modules/tracking/application/ports/tracking.validation-lifecycle.repository'
import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import {
  deriveAlertTransitions,
  deriveTransshipment,
} from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import type {
  NewTrackingAlert,
  TrackingAlert,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { diffObservations } from '~/modules/tracking/features/observation/application/orchestration/diffObservations'
import { normalizeSnapshot } from '~/modules/tracking/features/observation/application/orchestration/normalizeSnapshot'
import type {
  NewObservation,
  Observation,
} from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
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
  readonly trackingValidationLifecycleRepository?: TrackingValidationLifecycleRepository
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
): Promise<PipelineResult> {
  // Step 1: Snapshot is already persisted by the caller (or we persist it here)
  // The snapshot should already have an id at this point.

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

  // Step 4: Persist new observations
  let newObservations: readonly Observation[] = []
  if (newObsToInsert.length > 0) {
    newObservations = await deps.observationRepository.insertMany(newObsToInsert)
  }

  // Step 5: Derive Timeline (from ALL observations, not just new ones)
  const allObservations = await deps.observationRepository.findAllByContainerId(containerId)
  const timeline = deriveTimeline(containerId, containerNumber, allObservations)

  // Step 6: Derive Status
  const status = deriveStatus(timeline)

  // Step 7: Derive Alerts
  // Fact alerts dedupe by historical fingerprint, so derivation must see full history.
  const existingAlerts =
    await deps.trackingAlertRepository.findAlertDerivationStateByContainerId(containerId)
  const alertTransitions = deriveAlertTransitions(timeline, status, existingAlerts, isBackfill)
  const newAlertDescriptors: readonly NewTrackingAlert[] = alertTransitions.newAlerts

  if (alertTransitions.monitoringAutoResolutions.length > 0) {
    const reasonByAlertId = new Map(
      alertTransitions.monitoringAutoResolutions.map(
        (entry) => [entry.alertId, entry.reason] as const,
      ),
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
        await deps.trackingAlertRepository.autoResolveMany({
          alertIds,
          resolvedAt,
          reason,
        })
      }
    }
  }

  // Step 8: Persist new alerts
  let newAlerts: readonly TrackingAlert[] = []
  if (newAlertDescriptors.length > 0) {
    newAlerts = await deps.trackingAlertRepository.insertMany(newAlertDescriptors)
  }

  // Derive transshipment info
  const transshipment = deriveTransshipment(timeline)
  const trackingValidationProjection = deriveTrackingValidationProjection(
    createTrackingValidationContext({
      containerId,
      containerNumber,
      observations: allObservations,
      timeline,
      status,
      transshipment,
      now: systemClock.now(),
    }),
  )
  const trackingValidationLifecycleRepository =
    deps.trackingValidationLifecycleRepository ?? noopTrackingValidationLifecycleRepository
  const existingValidationLifecycleStates = await loadTrackingValidationLifecycleStates({
    repository: trackingValidationLifecycleRepository,
    containerId,
    containerNumber,
  })
  const validationLifecycleTransitions = deriveTrackingValidationLifecycleTransitions({
    activeFindings: trackingValidationProjection.findings,
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
    newAlerts,
    timeline,
    status,
    transshipment,
    trackingValidation: trackingValidationProjection.summary,
  }
}
