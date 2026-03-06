import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingAlert } from '~/modules/tracking/domain/model/trackingAlert'
import type {
  AlertResponseDto,
  SnapshotResponseDto,
} from '~/modules/tracking/interface/http/tracking.schemas'

// ---------------------------------------------------------------------------
// Alerts — Result → Response DTO mappers
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
  }
}

// ---------------------------------------------------------------------------
// Snapshots — Result → Response DTO mappers
// ---------------------------------------------------------------------------

/**
 * Maps a domain Snapshot to the HTTP response DTO (minimal shape).
 */
export function toSnapshotResponseDto(snapshot: Snapshot): SnapshotResponseDto {
  return {
    id: snapshot.id,
    container_id: snapshot.container_id,
    provider: snapshot.provider,
    fetched_at: snapshot.fetched_at,
    parse_error: snapshot.parse_error ?? null,
  }
}
