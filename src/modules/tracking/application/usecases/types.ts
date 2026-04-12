import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { TrackingContainmentRepository } from '~/modules/tracking/application/ports/tracking.containment.repository'
import type { ObservationRepository } from '~/modules/tracking/application/ports/tracking.observation.repository'
import type { SnapshotRepository } from '~/modules/tracking/application/ports/tracking.snapshot.repository'
import type { SyncMetadataRepository } from '~/modules/tracking/application/ports/tracking.sync-metadata.repository'
import type { TrackingValidationLifecycleRepository } from '~/modules/tracking/application/ports/tracking.validation-lifecycle.repository'
import type { TrackingReplayAdminRepository } from '~/modules/tracking/features/replay/application/ports/tracking-replay-admin.repository'
import type { TrackingReplayLockRepository } from '~/modules/tracking/features/replay/application/ports/tracking-replay-lock.repository'

/**
 * Shared dependency type for all tracking use cases.
 *
 * Injected via the facade (`createTrackingUseCases`) so that
 * each use case remains a pure function of (deps, command) → Result.
 */
export type TrackingUseCasesDeps = {
  readonly snapshotRepository: SnapshotRepository
  readonly observationRepository: ObservationRepository
  readonly trackingAlertRepository: TrackingAlertRepository
  readonly syncMetadataRepository: SyncMetadataRepository
  readonly trackingContainmentRepository?: TrackingContainmentRepository
  readonly trackingValidationLifecycleRepository?: TrackingValidationLifecycleRepository
  readonly replayAdminRepository?: TrackingReplayAdminRepository
  readonly replayLockRepository?: TrackingReplayLockRepository
}
