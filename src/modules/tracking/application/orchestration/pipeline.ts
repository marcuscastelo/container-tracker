import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { ObservationRepository } from '~/modules/tracking/application/ports/tracking.observation.repository'
import type { SnapshotRepository } from '~/modules/tracking/application/ports/tracking.snapshot.repository'
import { deriveAlerts, deriveTransshipment } from '~/modules/tracking/domain/derive/deriveAlerts'
import { deriveStatus } from '~/modules/tracking/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/domain/derive/deriveTimeline'
import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import type { ContainerStatus } from '~/modules/tracking/domain/model/containerStatus'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { Timeline } from '~/modules/tracking/domain/model/timeline'
import type { NewTrackingAlert, TrackingAlert } from '~/modules/tracking/domain/model/trackingAlert'
import { diffObservations } from '~/modules/tracking/features/observation/application/orchestration/diffObservations'
import { normalizeSnapshot } from '~/modules/tracking/features/observation/application/orchestration/normalizeSnapshot'
import type {
  NewObservation,
  Observation,
} from '~/modules/tracking/features/observation/domain/model/observation'

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
}

/**
 * Pipeline dependencies — injected repositories.
 */
type PipelineDeps = {
  readonly snapshotRepository: SnapshotRepository
  readonly observationRepository: ObservationRepository
  readonly trackingAlertRepository: TrackingAlertRepository
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
  const existingActiveAlerts =
    await deps.trackingAlertRepository.findActiveByContainerId(containerId)
  const newAlertDescriptors: readonly NewTrackingAlert[] = deriveAlerts(
    timeline,
    status,
    existingActiveAlerts,
    isBackfill,
  )

  // Step 8: Persist new alerts
  let newAlerts: readonly TrackingAlert[] = []
  if (newAlertDescriptors.length > 0) {
    newAlerts = await deps.trackingAlertRepository.insertMany(newAlertDescriptors)
  }

  // Derive transshipment info
  const transshipment = deriveTransshipment(timeline)

  return {
    newObservations,
    newAlerts,
    timeline,
    status,
    transshipment,
  }
}
