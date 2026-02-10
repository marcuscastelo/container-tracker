import type { NewTrackingAlert, TrackingAlert } from '~/modules/tracking/domain/trackingAlert'
import type { SupabaseResult } from '~/shared/supabase/supabaseResult'

/**
 * Repository interface for TrackingAlert persistence.
 */
export type TrackingAlertRepository = {
  /** Persist new alerts. Returns the alerts with generated ids. */
  insertMany(alerts: readonly NewTrackingAlert[]): Promise<SupabaseResult<readonly TrackingAlert[]>>

  /** Fetch active (non-dismissed, non-acked) alerts for a container. */
  findActiveByContainerId(containerId: string): Promise<SupabaseResult<readonly TrackingAlert[]>>

  /** Fetch the set of active alert types for a container (for dedup). */
  findActiveTypesByContainerId(containerId: string): Promise<SupabaseResult<ReadonlySet<string>>>

  /** Acknowledge an alert by id. */
  acknowledge(alertId: string, ackedAt: string): Promise<SupabaseResult<object>>

  /** Dismiss an alert by id. */
  dismiss(alertId: string, dismissedAt: string): Promise<SupabaseResult<object>>
}
