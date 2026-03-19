import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import type {
  NewTrackingAlert,
  TrackingAlert,
  TrackingAlertAckSource,
  TrackingAlertDerivationState,
  TrackingAlertResolvedReason,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'

/**
 * Repository interface for TrackingAlert persistence.
 */
export type TrackingAlertRepository = {
  /** Persist new alerts. Returns the alerts with generated ids. */
  insertMany(alerts: readonly NewTrackingAlert[]): Promise<readonly TrackingAlert[]>

  /** Fetch active alerts for a container. */
  findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]>

  /** Fetch all alerts for a container (active + acknowledged). */
  findByContainerId(containerId: string): Promise<readonly TrackingAlert[]>

  /** Fetch lightweight alert state required by snapshot-time derivation/dedup. */
  findAlertDerivationStateByContainerId(
    containerId: string,
  ): Promise<readonly TrackingAlertDerivationState[]>

  /** Resolve container numbers for container ids. */
  findContainerNumbersByIds(containerIds: readonly string[]): Promise<ReadonlyMap<string, string>>

  /** Fetch the set of active alert types for a container (for dedup). */
  findActiveTypesByContainerId(containerId: string): Promise<ReadonlySet<string>>

  /**
   * Fetch operational alert read model rows enriched with process ownership.
   *
   * Implementations may return inactive rows; application read model enforces
   * active-only output via `is_active`.
   */
  listActiveAlertReadModel(): Promise<readonly TrackingActiveAlertReadModel[]>

  /** Acknowledge an alert by id. */
  acknowledge(
    alertId: string,
    ackedAt: string,
    metadata: {
      readonly ackedBy: string | null
      readonly ackedSource: TrackingAlertAckSource | null
    },
  ): Promise<void>

  /** Mark an acknowledged alert as active again by id. */
  unacknowledge(alertId: string): Promise<void>

  /** Auto-resolve active monitoring alerts by ids. */
  autoResolveMany(command: {
    readonly alertIds: readonly string[]
    readonly resolvedAt: string
    readonly reason: TrackingAlertResolvedReason
  }): Promise<void>
}
