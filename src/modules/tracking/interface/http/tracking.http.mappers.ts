import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingAlertDisplayReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.alert-display.readmodel'
import { toTrackingAlertMessageContract } from '~/modules/tracking/features/alerts/application/projection/tracking.alert-message-contract.mapper'
import { resolveAlertLifecycleState } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type {
  AlertResponseDto,
  SnapshotResponseDto,
} from '~/modules/tracking/interface/http/tracking.schemas'

// ---------------------------------------------------------------------------
// Alerts — Result → Response DTO mappers
// ---------------------------------------------------------------------------

/**
 * Maps a tracking alert display read model to the HTTP response DTO.
 *
 * This is the only place that shapes alert display data for the HTTP boundary.
 */
export function toAlertResponseDto(alert: TrackingAlertDisplayReadModel): AlertResponseDto {
  const lifecycleState = resolveAlertLifecycleState(alert)
  return {
    id: alert.id,
    container_number: alert.container_number,
    category: alert.category,
    type: alert.type,
    severity: alert.severity,
    ...toTrackingAlertMessageContract(alert),
    detected_at: alert.detected_at,
    triggered_at: alert.triggered_at,
    retroactive: alert.retroactive,
    provider: alert.provider,
    lifecycle_state: lifecycleState,
    acked_at: alert.acked_at,
    resolved_at: alert.resolved_at ?? null,
    resolved_reason: alert.resolved_reason ?? null,
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
