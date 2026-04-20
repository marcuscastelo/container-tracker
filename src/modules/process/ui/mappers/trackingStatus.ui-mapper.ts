import { STATUS_COLOR } from '~/modules/process/ui/status-color'
import {
  type TrackingStatusCode,
  toTrackingStatusCode,
} from '~/modules/tracking/features/status/application/projection/tracking.status.projection'
import type { TranslationKeys } from '~/shared/localization/translationTypes'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export { toTrackingStatusCode }

export function trackingStatusToVariant(statusCode: TrackingStatusCode | string): StatusVariant {
  const normalizedStatusCode = toTrackingStatusCode(statusCode)
  return STATUS_COLOR[normalizedStatusCode]
}

export function trackingStatusToLabelKey(
  keys: TranslationKeys,
  statusCode: TrackingStatusCode | string,
): string {
  const normalizedStatusCode = toTrackingStatusCode(statusCode)

  switch (normalizedStatusCode) {
    case 'BOOKED':
      return keys.tracking.status.BOOKED
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
