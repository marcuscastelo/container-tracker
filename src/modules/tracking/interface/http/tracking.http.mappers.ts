import type { TrackingAlertDisplayReadModel } from '~/modules/tracking/application/projection/tracking.alert-display.readmodel'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingAlertMessageContract } from '~/modules/tracking/domain/model/trackingAlert'
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
function toAlertMessageContractDto(
  alert: TrackingAlertDisplayReadModel,
): TrackingAlertMessageContract {
  switch (alert.message_key) {
    case 'alerts.transshipmentDetected':
      return {
        message_key: alert.message_key,
        message_params: alert.message_params,
      }
    case 'alerts.customsHoldDetected':
      return {
        message_key: alert.message_key,
        message_params: alert.message_params,
      }
    case 'alerts.noMovementDetected':
      return {
        message_key: alert.message_key,
        message_params: alert.message_params,
      }
    case 'alerts.etaMissing':
      return {
        message_key: alert.message_key,
        message_params: alert.message_params,
      }
    case 'alerts.etaPassed':
      return {
        message_key: alert.message_key,
        message_params: alert.message_params,
      }
    case 'alerts.portChange':
      return {
        message_key: alert.message_key,
        message_params: alert.message_params,
      }
    case 'alerts.dataInconsistent':
      return {
        message_key: alert.message_key,
        message_params: alert.message_params,
      }
  }
}

export function toAlertResponseDto(alert: TrackingAlertDisplayReadModel): AlertResponseDto {
  return {
    id: alert.id,
    container_number: alert.container_number,
    category: alert.category,
    type: alert.type,
    severity: alert.severity,
    ...toAlertMessageContractDto(alert),
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
