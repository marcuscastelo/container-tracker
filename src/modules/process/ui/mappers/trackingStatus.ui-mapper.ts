import type { TrackingStatusCode } from '~/modules/tracking/features/status/application/projection/tracking.status.projection'
import {
  TRACKING_STATUS_CODES,
  toTrackingStatusCode,
} from '~/modules/tracking/features/status/application/projection/tracking.status.projection'
import type { TranslationKeys } from '~/shared/localization/translationTypes'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export { toTrackingStatusCode }

export function trackingStatusToRank(statusCode: TrackingStatusCode): number {
  const idx = TRACKING_STATUS_CODES.indexOf(statusCode)
  return idx >= 0 ? idx : 0
}

export function trackingStatusToVariant(statusCode: TrackingStatusCode | string): StatusVariant {
  switch (statusCode) {
    case 'IN_TRANSIT':
      return 'in-transit'
    case 'LOADED':
      return 'loaded'
    case 'ARRIVED_AT_POD':
    case 'DISCHARGED':
    case 'AVAILABLE_FOR_PICKUP':
      return 'released'
    case 'DELIVERED':
    case 'EMPTY_RETURNED':
      return 'delivered'
    case 'IN_PROGRESS':
      return 'pending'
    case 'PARTIALLY_DELIVERED':
      return 'partial'
    default:
      return 'unknown'
  }
}

export function trackingStatusToLabelKey(
  keys: TranslationKeys,
  statusCode: TrackingStatusCode | string,
): string {
  switch (statusCode) {
    case 'IN_PROGRESS':
      return keys.tracking.status.IN_PROGRESS
    case 'LOADED':
      return keys.tracking.status.LOADED
    case 'IN_TRANSIT':
      return keys.tracking.status.IN_TRANSIT
    case 'ARRIVED_AT_POD':
      return keys.tracking.status.ARRIVED_AT_POD
    case 'DISCHARGED':
      return keys.tracking.status.DISCHARGED
    case 'AVAILABLE_FOR_PICKUP':
      return keys.tracking.status.AVAILABLE_FOR_PICKUP
    case 'DELIVERED':
      return keys.tracking.status.DELIVERED
    case 'EMPTY_RETURNED':
      return keys.tracking.status.EMPTY_RETURNED
    case 'PARTIALLY_DELIVERED':
      return keys.tracking.status.PARTIALLY_DELIVERED
    default:
      return keys.tracking.status.UNKNOWN
  }
}
