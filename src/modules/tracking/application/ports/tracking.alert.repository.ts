import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import type {
  NewTrackingAlert,
  TrackingAlert,
  TrackingAlertAckSource,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'

/**
 * Repository interface for TrackingAlert persistence.
 */
export type TrackingAlertRepository = {
  /** Persist new alerts. Returns the alerts with generated ids. */
  insertMany(alerts: readonly NewTrackingAlert[]): Promise<readonly TrackingAlert[]>

  /** Fetch active (non-acked) alerts for a container. */
  findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]>

  /** Fetch all alerts for a container (active + acknowledged). */
  findByContainerId(containerId: string): Promise<readonly TrackingAlert[]>

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
}
