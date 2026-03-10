import type {
  OperationalStatusCounts,
  ProcessStatusMicrobadge,
} from '~/modules/process/features/operational-projection/application/deriveProcessStatus'
import type {
  OperationalAlertSeverity,
  OperationalStatus,
  ProcessAggregatedStatus,
} from '~/modules/process/features/operational-projection/application/operationalSemantics'
import type { TrackingLifecycleBucket } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'

/**
 * Process-level operational summary — Application-layer read model.
 *
 * Aggregates tracking data from all containers in a process into
 * a single projection suitable for dashboard list views.
 *
 * This is a read-model, NOT a domain entity.
 *
 * Future optimization: cache ProcessOperationalSummary at snapshot ingestion time.
 */
export type ProcessOperationalSummary = {
  readonly process_id: string
  readonly reference: string | null
  readonly carrier: string | null
  readonly container_count: number

  readonly process_status: ProcessAggregatedStatus
  readonly highest_container_status: OperationalStatus | null
  readonly status_counts: OperationalStatusCounts
  readonly status_microbadge: ProcessStatusMicrobadge | null
  readonly has_status_dispersion: boolean
  readonly eta: string | null
  readonly lifecycle_bucket: TrackingLifecycleBucket
  readonly final_delivery_complete: boolean
  readonly full_logistics_complete: boolean
  readonly eta_coverage: {
    readonly total: number
    readonly eligible_total: number
    readonly with_eta: number
  }

  readonly alerts_count: number
  readonly highest_alert_severity: OperationalAlertSeverity | null
  readonly dominant_alert_created_at: string | null

  readonly has_transshipment: boolean
  readonly last_event_at: string | null
}
