import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { ObservationRepository } from '~/modules/tracking/application/ports/tracking.observation.repository'
import type { SnapshotRepository } from '~/modules/tracking/application/ports/tracking.snapshot.repository'
import type { SyncMetadataRepository } from '~/modules/tracking/application/ports/tracking.sync-metadata.repository'

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
}
