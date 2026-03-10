import {
  isProcessOnlyStatus,
  PROCESS_STATUS_COLOR,
  PROCESS_STATUS_FILTER_ORDER,
  type ProcessStatusCode,
  toProcessStatusCode,
} from '~/modules/process/ui/process-status-color'
import { STATUS_COLOR } from '~/modules/process/ui/status-color'
import { toTrackingStatusCode } from '~/modules/tracking/features/status/application/projection/tracking.status.projection'
import type { TranslationKeys } from '~/shared/localization/translationTypes'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export { toTrackingStatusCode }
export { toProcessStatusCode }
export type { ProcessStatusCode }

export function trackingStatusToRank(statusCode: ProcessStatusCode): number {
  const idx = PROCESS_STATUS_FILTER_ORDER.indexOf(statusCode)
  return idx >= 0 ? idx : 0
}

export function trackingStatusToVariant(statusCode: ProcessStatusCode | string): StatusVariant {
  const normalizedStatusCode = toProcessStatusCode(statusCode)

  if (isProcessOnlyStatus(normalizedStatusCode)) {
    return PROCESS_STATUS_COLOR[normalizedStatusCode]
  }

  return STATUS_COLOR[normalizedStatusCode]
}

export function trackingStatusToLabelKey(
  keys: TranslationKeys,
  statusCode: ProcessStatusCode | string,
): string {
  const normalizedStatusCode = toProcessStatusCode(statusCode)

  switch (normalizedStatusCode) {
    case 'BOOKED':
      return keys.tracking.status.BOOKED
    case 'AWAITING_DATA':
      return keys.tracking.status.AWAITING_DATA
    case 'NOT_SYNCED':
      return keys.tracking.status.NOT_SYNCED
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
