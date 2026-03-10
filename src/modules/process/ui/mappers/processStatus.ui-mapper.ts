import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import {
  isProcessOnlyStatus,
  PROCESS_STATUS_COLOR,
  PROCESS_STATUS_FILTER_ORDER,
  type ProcessStatusCode,
  toProcessStatusCode,
} from '~/modules/process/ui/process-status-color'
import { STATUS_COLOR } from '~/modules/process/ui/status-color'
import type { TranslationKeys } from '~/shared/localization/translationTypes'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export { toProcessStatusCode }
export type { ProcessStatusCode }

export function processStatusToRank(statusCode: ProcessStatusCode): number {
  const idx = PROCESS_STATUS_FILTER_ORDER.indexOf(statusCode)
  return idx >= 0 ? idx : 0
}

export function processStatusToVariant(statusCode: ProcessStatusCode | string): StatusVariant {
  const normalizedStatusCode = toProcessStatusCode(statusCode)

  if (isProcessOnlyStatus(normalizedStatusCode)) {
    return PROCESS_STATUS_COLOR[normalizedStatusCode]
  }

  return STATUS_COLOR[normalizedStatusCode]
}

export function processStatusToLabelKey(
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
    default:
      return trackingStatusToLabelKey(keys, normalizedStatusCode)
  }
}
