import type { ObservationRepository } from '~/modules/tracking/domain/observation.repository'
import type { SnapshotRepository } from '~/modules/tracking/domain/snapshot.repository'
import type { TrackingAlertRepository } from '~/modules/tracking/domain/tracking-alert.repository'

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
}
