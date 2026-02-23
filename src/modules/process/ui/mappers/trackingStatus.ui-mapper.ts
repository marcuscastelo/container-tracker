import type { TrackingStatusCode } from '~/modules/tracking/application/projection/tracking.status.projection'
import { toTrackingStatusCode } from '~/modules/tracking/application/projection/tracking.status.projection'
import type { TranslationKeys } from '~/shared/localization/translationTypes'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export { toTrackingStatusCode }
export type { TrackingStatusCode }

export function trackingStatusToVariant(statusCode: TrackingStatusCode): StatusVariant {
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
    default:
      return 'unknown'
  }
}

export function trackingStatusToLabelKey(
  keys: TranslationKeys,
  statusCode: TrackingStatusCode,
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
    default:
      return keys.tracking.status.UNKNOWN
  }
}
