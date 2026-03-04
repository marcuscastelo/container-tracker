import type { TrackingActiveAlertReadModel } from '~/modules/tracking/application/projection/tracking.active-alert.readmodel'
import type { NewTrackingAlert, TrackingAlert } from '~/modules/tracking/domain/model/trackingAlert'

/**
 * Repository interface for TrackingAlert persistence.
 */
export type TrackingAlertRepository = {
  /** Persist new alerts. Returns the alerts with generated ids. */
  insertMany(alerts: readonly NewTrackingAlert[]): Promise<readonly TrackingAlert[]>

  /** Fetch active (non-dismissed, non-acked) alerts for a container. */
  findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]>

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
  acknowledge(alertId: string, ackedAt: string): Promise<void>

  /** Dismiss an alert by id. */
  dismiss(alertId: string, dismissedAt: string): Promise<void>
}
