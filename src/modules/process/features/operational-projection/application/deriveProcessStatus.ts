import type {
  OperationalStatus,
  ProcessAggregatedStatus,
} from '~/modules/process/features/operational-projection/application/operationalSemantics'

/**
 * Process pre-shipment phase mapped from container lifecycle.
 */
const PRE_SHIPMENT_STATUSES: ReadonlySet<OperationalStatus> = new Set(['UNKNOWN', 'IN_PROGRESS'])

/**
 * Transportation + arrival statuses keep the process operationally in transit.
 */
const TRANSIT_STATUSES: ReadonlySet<OperationalStatus> = new Set([
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED_AT_POD',
])

/**
 * Arrival/port operation statuses that are not completed yet.
 */
const ARRIVAL_RISK_STATUSES: ReadonlySet<OperationalStatus> = new Set([
  'DISCHARGED',
  'AVAILABLE_FOR_PICKUP',
])

/**
 * Final completion statuses.
 */
const FINAL_DELIVERY_STATUSES: ReadonlySet<OperationalStatus> = new Set([
  'DELIVERED',
  'EMPTY_RETURNED',
])

function isPreShipment(status: OperationalStatus): boolean {
  return PRE_SHIPMENT_STATUSES.has(status)
}

function isTransit(status: OperationalStatus): boolean {
  return TRANSIT_STATUSES.has(status)
}

function isArrivalRisk(status: OperationalStatus): boolean {
  return ARRIVAL_RISK_STATUSES.has(status)
}

function isFinalDelivery(status: OperationalStatus): boolean {
  return FINAL_DELIVERY_STATUSES.has(status)
}

/**
 * Derive process-level status from container statuses only.
 * This function intentionally does not look at events/observations.
 */
export function deriveProcessStatusFromContainers(
  statuses: readonly OperationalStatus[],
): ProcessAggregatedStatus {
  if (statuses.length === 0) return 'UNKNOWN'
  if (statuses.every((status) => status === 'UNKNOWN')) return 'UNKNOWN'

  const allFinal = statuses.every(isFinalDelivery)
  if (allFinal) return 'DELIVERED'

  const allDischargedOrBeyond = statuses.every(
    (status) => isArrivalRisk(status) || isFinalDelivery(status),
  )
  const hasArrivalRisk = statuses.some(isArrivalRisk)
  if (allDischargedOrBeyond && hasArrivalRisk) {
    return 'DISCHARGED'
  }

  const hasTransit = statuses.some(isTransit)
  if (hasTransit) {
    return 'IN_TRANSIT'
  }

  const allPreShipment = statuses.every(isPreShipment)
  const hasPreShipmentEvidence = statuses.some((status) => status !== 'UNKNOWN')
  if (allPreShipment && hasPreShipmentEvidence) {
    return 'BOOKED'
  }

  // Conservative fallback for mixed/inconsistent groups.
  return 'IN_TRANSIT'
}
