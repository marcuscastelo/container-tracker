export type OperationalStatus =
  | 'UNKNOWN'
  | 'IN_PROGRESS'
  | 'LOADED'
  | 'IN_TRANSIT'
  | 'ARRIVED_AT_POD'
  | 'DISCHARGED'
  | 'AVAILABLE_FOR_PICKUP'
  | 'DELIVERED'
  | 'EMPTY_RETURNED'

/**
 * Process-level aggregated status — includes PARTIALLY_DELIVERED
 * which is not a valid container status but represents a mixed state
 * across containers in a process.
 */
export type ProcessAggregatedStatus = OperationalStatus | 'PARTIALLY_DELIVERED'

export const OPERATIONAL_STATUSES: readonly OperationalStatus[] = [
  'UNKNOWN',
  'IN_PROGRESS',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED_AT_POD',
  'DISCHARGED',
  'AVAILABLE_FOR_PICKUP',
  'DELIVERED',
  'EMPTY_RETURNED',
]

export type OperationalAlertSeverity = 'info' | 'warning' | 'danger'

const operationalStatusDominance: readonly OperationalStatus[] = OPERATIONAL_STATUSES

function isOperationalStatus(value: string): value is OperationalStatus {
  return OPERATIONAL_STATUSES.some((status) => status === value)
}

export function toOperationalStatus(status: string | null | undefined): OperationalStatus {
  if (!status) return 'UNKNOWN'
  return isOperationalStatus(status) ? status : 'UNKNOWN'
}

export function operationalStatusDominanceIndex(status: OperationalStatus): number {
  const idx = operationalStatusDominance.indexOf(status)
  return idx >= 0 ? idx : 0
}

export function toOperationalAlertSeverity(
  severity: string | null | undefined,
): OperationalAlertSeverity | null {
  if (severity === 'info' || severity === 'warning' || severity === 'danger') {
    return severity
  }
  return null
}
