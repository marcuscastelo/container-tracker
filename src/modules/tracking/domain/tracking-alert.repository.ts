import type { NewTrackingAlert, TrackingAlert } from '~/modules/tracking/domain/trackingAlert'

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

  /** Acknowledge an alert by id. */
  acknowledge(alertId: string, ackedAt: string): Promise<void>

  /** Dismiss an alert by id. */
  dismiss(alertId: string, dismissedAt: string): Promise<void>
}
