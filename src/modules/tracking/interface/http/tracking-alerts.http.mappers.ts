import type { TrackingAlert } from '~/modules/tracking/domain/trackingAlert'
import type { AlertResponseDto } from '~/modules/tracking/interface/http/tracking-alerts.schemas'

// ---------------------------------------------------------------------------
// Result → Response DTO mappers
// ---------------------------------------------------------------------------

/**
 * Maps a domain TrackingAlert to the HTTP response DTO.
 *
 * This is the only place that shapes a TrackingAlert for the HTTP boundary.
 */
export function toAlertResponseDto(alert: TrackingAlert): AlertResponseDto {
  return {
    id: alert.id,
    category: alert.category,
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    detected_at: alert.detected_at,
    triggered_at: alert.triggered_at,
    retroactive: alert.retroactive,
    provider: alert.provider,
    acked_at: alert.acked_at,
    dismissed_at: alert.dismissed_at,
  }
}
