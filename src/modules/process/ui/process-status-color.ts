import {
  TRACKING_STATUS_CODES,
  type TrackingStatusCode,
  toTrackingStatusCode,
} from '~/modules/tracking/features/status/application/projection/tracking.status.projection'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

const PROCESS_ONLY_STATUS_CODES = ['BOOKED', 'AWAITING_DATA', 'NOT_SYNCED'] as const

type ProcessOnlyStatusCode = (typeof PROCESS_ONLY_STATUS_CODES)[number]

export type ProcessStatusCode = TrackingStatusCode | ProcessOnlyStatusCode

export const PROCESS_STATUS_COLOR = {
  BOOKED: 'slate-400',
  AWAITING_DATA: 'amber-600',
  NOT_SYNCED: 'amber-700',
} satisfies Readonly<Record<ProcessOnlyStatusCode, StatusVariant>>

export const PROCESS_STATUS_FILTER_ORDER: readonly ProcessStatusCode[] = [
  'UNKNOWN',
  'BOOKED',
  'IN_PROGRESS',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED_AT_POD',
  'DISCHARGED',
  'AVAILABLE_FOR_PICKUP',
  'DELIVERED',
  'EMPTY_RETURNED',
  'AWAITING_DATA',
  'NOT_SYNCED',
]

function isProcessOnlyStatusCode(value: string): value is ProcessOnlyStatusCode {
  return PROCESS_ONLY_STATUS_CODES.some((statusCode) => statusCode === value)
}

function isTrackingStatusCode(value: string): value is TrackingStatusCode {
  return TRACKING_STATUS_CODES.some((statusCode) => statusCode === value)
}

export function parseProcessStatusCode(value: string): ProcessStatusCode | null {
  if (isProcessOnlyStatusCode(value)) return value
  if (isTrackingStatusCode(value)) return value
  return null
}

export function toProcessStatusCode(status: string | null | undefined): ProcessStatusCode {
  if (!status) return 'UNKNOWN'
  if (isProcessOnlyStatusCode(status)) return status
  return toTrackingStatusCode(status)
}

export function isProcessOnlyStatus(status: ProcessStatusCode): status is ProcessOnlyStatusCode {
  return isProcessOnlyStatusCode(status)
}
