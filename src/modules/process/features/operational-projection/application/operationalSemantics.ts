export type OperationalStatus =
  | 'UNKNOWN'
  | 'IN_PROGRESS'
  | 'BOOKED'
  | 'LOADED'
  | 'IN_TRANSIT'
  | 'ARRIVED_AT_POD'
  | 'DISCHARGED'
  | 'AVAILABLE_FOR_PICKUP'
  | 'DELIVERED'
  | 'EMPTY_RETURNED'

export type ProcessAggregatedStatus =
  | 'UNKNOWN'
  | 'BOOKED'
  | 'IN_TRANSIT'
  | 'ARRIVED_AT_POD'
  | 'DISCHARGED'
  | 'DELIVERED'
  | 'AWAITING_DATA'
  | 'NOT_SYNCED'

const OPERATIONAL_STATUSES: readonly OperationalStatus[] = [
  'UNKNOWN',
  'IN_PROGRESS',
  'BOOKED',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED_AT_POD',
  'DISCHARGED',
  'AVAILABLE_FOR_PICKUP',
  'DELIVERED',
  'EMPTY_RETURNED',
]

export type OperationalAlertSeverity = 'info' | 'warning' | 'danger'

function isOperationalStatus(value: string): value is OperationalStatus {
  return OPERATIONAL_STATUSES.some((status) => status === value)
}

export function toOperationalStatus(status: string | null | undefined): OperationalStatus {
  if (!status) return 'UNKNOWN'
  return isOperationalStatus(status) ? status : 'UNKNOWN'
}

export function toOperationalAlertSeverity(
  severity: string | null | undefined,
): OperationalAlertSeverity | null {
  if (severity === 'info' || severity === 'warning' || severity === 'danger') {
    return severity
  }
  return null
}
