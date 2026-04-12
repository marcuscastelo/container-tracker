import type {
  OperationalStatusCounts,
  ProcessStatusMicrobadge,
} from '~/modules/process/features/operational-projection/application/deriveProcessStatus'
import type {
  OperationalAlertSeverity,
  OperationalStatus,
  ProcessAggregatedStatus,
} from '~/modules/process/features/operational-projection/application/operationalSemantics'
import type {
  OperationalIncidentReadModel,
} from '~/modules/tracking/application/projection/tracking.operational-incidents.readmodel'
import type { TrackingLifecycleBucket } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { TrackingValidationProcessSummary } from '~/modules/tracking/features/validation/application/projection/trackingValidation.projection'
import type { TrackingValidationDisplayIssue } from '~/modules/tracking/features/validation/application/projection/trackingValidationDisplayIssue'
import type { TemporalValueDto } from '~/shared/time/dto'

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
  readonly eta: TemporalValueDto | null
  readonly lifecycle_bucket: TrackingLifecycleBucket
  readonly final_delivery_complete: boolean
  readonly full_logistics_complete: boolean
  readonly eta_display:
    | {
        readonly kind: 'date'
        readonly value: TemporalValueDto
      }
    | {
        readonly kind: 'arrived'
        readonly value: TemporalValueDto
      }
    | {
        readonly kind: 'unavailable'
      }
    | {
        readonly kind: 'delivered'
      }
  readonly eta_coverage: {
    readonly total: number
    readonly eligible_total: number
    readonly with_eta: number
  }

  readonly operational_incidents: {
    readonly summary: {
      readonly active_incidents_count: number
      readonly affected_containers_count: number
      readonly recognized_incidents_count: number
    }
    readonly dominant: Pick<
      OperationalIncidentReadModel,
      | 'incidentKey'
      | 'category'
      | 'type'
      | 'severity'
      | 'fact'
      | 'action'
      | 'detectedAt'
      | 'triggeredAt'
      | 'scope'
    > | null
  }
  readonly attention_severity: OperationalAlertSeverity | null
  readonly tracking_validation: TrackingValidationProcessSummary
  readonly tracking_validation_top_issue: TrackingValidationDisplayIssue | null

  readonly last_event_at: TemporalValueDto | null
}
