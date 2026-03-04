import type {
  OperationalAlertSeverity,
  ProcessAggregatedStatus,
} from '~/modules/process/application/operational-projection/operationalSemantics'

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
  readonly eta: string | null

  readonly alerts_count: number
  readonly highest_alert_severity: OperationalAlertSeverity | null

  readonly has_transshipment: boolean
  readonly last_event_at: string | null
}
