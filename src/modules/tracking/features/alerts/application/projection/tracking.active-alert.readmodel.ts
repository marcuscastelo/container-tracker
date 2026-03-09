import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'

/**
 * Tracking application read model for operational active alerts.
 *
 * This shape is intentionally backend-facing (snake_case) so downstream
 * capabilities can compose it without re-deriving alert semantics.
 */
export type TrackingActiveAlertReadModel = {
  readonly alert_id: string
  readonly process_id: string
  readonly container_id: string
  readonly category: TrackingAlert['category']
  readonly severity: TrackingAlert['severity']
  readonly type: TrackingAlert['type']
  readonly generated_at: string
  readonly fingerprint: string | null
  readonly is_active: boolean
  readonly retroactive: boolean
}

/**
 * Enforce "active only" output for consumers while preserving canonical
 * alert fields (fact/monitoring and type values) without mutation.
 */
export function toTrackingActiveAlertReadModel(
  alerts: readonly TrackingActiveAlertReadModel[],
): readonly TrackingActiveAlertReadModel[] {
  return alerts
    .filter((alert) => alert.is_active)
    .map((alert) => ({
      alert_id: alert.alert_id,
      process_id: alert.process_id,
      container_id: alert.container_id,
      category: alert.category,
      severity: alert.severity,
      type: alert.type,
      generated_at: alert.generated_at,
      fingerprint: alert.fingerprint,
      is_active: true,
      retroactive: alert.retroactive,
    }))
}
