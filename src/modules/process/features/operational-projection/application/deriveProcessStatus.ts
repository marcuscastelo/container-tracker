import type {
  OperationalStatus,
  ProcessAggregatedStatus,
} from '~/modules/process/features/operational-projection/application/operationalSemantics'

export type OperationalStatusCounts = {
  readonly UNKNOWN: number
  readonly IN_PROGRESS: number
  readonly LOADED: number
  readonly IN_TRANSIT: number
  readonly ARRIVED_AT_POD: number
  readonly DISCHARGED: number
  readonly AVAILABLE_FOR_PICKUP: number
  readonly DELIVERED: number
  readonly EMPTY_RETURNED: number
}

export type ProcessStatusMicrobadge = {
  readonly status: OperationalStatus
  readonly count: number
}

export type ProcessStatusDispersion = {
  readonly highest_container_status: OperationalStatus | null
  readonly status_counts: OperationalStatusCounts
  readonly status_microbadge: ProcessStatusMicrobadge | null
  readonly has_status_dispersion: boolean
}

type MutableOperationalStatusCounts = {
  UNKNOWN: number
  IN_PROGRESS: number
  LOADED: number
  IN_TRANSIT: number
  ARRIVED_AT_POD: number
  DISCHARGED: number
  AVAILABLE_FOR_PICKUP: number
  DELIVERED: number
  EMPTY_RETURNED: number
}

const OPERATIONAL_STATUS_LIFECYCLE_ORDER: readonly OperationalStatus[] = [
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

const OPERATIONAL_STATUS_ORDER_INDEX: Readonly<Record<OperationalStatus, number>> = {
  UNKNOWN: 0,
  IN_PROGRESS: 1,
  LOADED: 2,
  IN_TRANSIT: 3,
  ARRIVED_AT_POD: 4,
  DISCHARGED: 5,
  AVAILABLE_FOR_PICKUP: 6,
  DELIVERED: 7,
  EMPTY_RETURNED: 8,
}

const MICROBADGE_MEANINGFUL_STATUSES: ReadonlySet<OperationalStatus> = new Set([
  'ARRIVED_AT_POD',
  'DISCHARGED',
  'AVAILABLE_FOR_PICKUP',
  'DELIVERED',
  'EMPTY_RETURNED',
])

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

function createEmptyOperationalStatusCounts(): MutableOperationalStatusCounts {
  return {
    UNKNOWN: 0,
    IN_PROGRESS: 0,
    LOADED: 0,
    IN_TRANSIT: 0,
    ARRIVED_AT_POD: 0,
    DISCHARGED: 0,
    AVAILABLE_FOR_PICKUP: 0,
    DELIVERED: 0,
    EMPTY_RETURNED: 0,
  }
}

function incrementStatusCount(
  statusCounts: MutableOperationalStatusCounts,
  status: OperationalStatus,
): void {
  if (status === 'UNKNOWN') {
    statusCounts.UNKNOWN += 1
    return
  }

  if (status === 'IN_PROGRESS') {
    statusCounts.IN_PROGRESS += 1
    return
  }

  if (status === 'LOADED') {
    statusCounts.LOADED += 1
    return
  }

  if (status === 'IN_TRANSIT') {
    statusCounts.IN_TRANSIT += 1
    return
  }

  if (status === 'ARRIVED_AT_POD') {
    statusCounts.ARRIVED_AT_POD += 1
    return
  }

  if (status === 'DISCHARGED') {
    statusCounts.DISCHARGED += 1
    return
  }

  if (status === 'AVAILABLE_FOR_PICKUP') {
    statusCounts.AVAILABLE_FOR_PICKUP += 1
    return
  }

  if (status === 'DELIVERED') {
    statusCounts.DELIVERED += 1
    return
  }

  statusCounts.EMPTY_RETURNED += 1
}

function toStatusCount(statusCounts: OperationalStatusCounts, status: OperationalStatus): number {
  if (status === 'UNKNOWN') return statusCounts.UNKNOWN
  if (status === 'IN_PROGRESS') return statusCounts.IN_PROGRESS
  if (status === 'LOADED') return statusCounts.LOADED
  if (status === 'IN_TRANSIT') return statusCounts.IN_TRANSIT
  if (status === 'ARRIVED_AT_POD') return statusCounts.ARRIVED_AT_POD
  if (status === 'DISCHARGED') return statusCounts.DISCHARGED
  if (status === 'AVAILABLE_FOR_PICKUP') return statusCounts.AVAILABLE_FOR_PICKUP
  if (status === 'DELIVERED') return statusCounts.DELIVERED
  return statusCounts.EMPTY_RETURNED
}

function resolveHighestContainerStatus(
  statusCounts: OperationalStatusCounts,
): OperationalStatus | null {
  for (let index = OPERATIONAL_STATUS_LIFECYCLE_ORDER.length - 1; index >= 0; index -= 1) {
    const status = OPERATIONAL_STATUS_LIFECYCLE_ORDER[index]
    if (status === undefined) continue
    if (toStatusCount(statusCounts, status) > 0) {
      return status
    }
  }

  return null
}

function countDistinctStatuses(statusCounts: OperationalStatusCounts): number {
  let distinct = 0

  for (const status of OPERATIONAL_STATUS_LIFECYCLE_ORDER) {
    if (toStatusCount(statusCounts, status) > 0) {
      distinct += 1
    }
  }

  return distinct
}

function toPrimaryStatusOrderIndex(primaryStatus: ProcessAggregatedStatus): number | null {
  if (primaryStatus === 'UNKNOWN') {
    return OPERATIONAL_STATUS_ORDER_INDEX.UNKNOWN
  }

  if (primaryStatus === 'BOOKED') {
    return OPERATIONAL_STATUS_ORDER_INDEX.IN_PROGRESS
  }

  if (primaryStatus === 'IN_TRANSIT') {
    return OPERATIONAL_STATUS_ORDER_INDEX.IN_TRANSIT
  }

  if (primaryStatus === 'DISCHARGED') {
    return OPERATIONAL_STATUS_ORDER_INDEX.DISCHARGED
  }

  if (primaryStatus === 'DELIVERED') {
    return OPERATIONAL_STATUS_ORDER_INDEX.DELIVERED
  }

  return null
}

function resolveProcessStatusMicrobadge(command: {
  readonly statusCounts: OperationalStatusCounts
  readonly primaryStatus: ProcessAggregatedStatus
}): ProcessStatusMicrobadge | null {
  const primaryStatusOrderIndex = toPrimaryStatusOrderIndex(command.primaryStatus)
  if (primaryStatusOrderIndex === null) return null

  for (
    let index = OPERATIONAL_STATUS_LIFECYCLE_ORDER.length - 1;
    index > primaryStatusOrderIndex;
    index -= 1
  ) {
    const candidateStatus = OPERATIONAL_STATUS_LIFECYCLE_ORDER[index]
    if (candidateStatus === undefined) continue
    if (!MICROBADGE_MEANINGFUL_STATUSES.has(candidateStatus)) continue

    const count = toStatusCount(command.statusCounts, candidateStatus)
    if (count <= 0) continue

    return {
      status: candidateStatus,
      count,
    }
  }

  return null
}

export function deriveOperationalStatusCounts(
  statuses: readonly OperationalStatus[],
): OperationalStatusCounts {
  const statusCounts = createEmptyOperationalStatusCounts()

  for (const status of statuses) {
    incrementStatusCount(statusCounts, status)
  }

  return statusCounts
}

export function deriveProcessStatusDispersion(command: {
  readonly statuses: readonly OperationalStatus[]
  readonly primaryStatus: ProcessAggregatedStatus
}): ProcessStatusDispersion {
  const statusCounts = deriveOperationalStatusCounts(command.statuses)
  const highestContainerStatus = resolveHighestContainerStatus(statusCounts)

  return {
    highest_container_status: highestContainerStatus,
    status_counts: statusCounts,
    status_microbadge: resolveProcessStatusMicrobadge({
      statusCounts,
      primaryStatus: command.primaryStatus,
    }),
    has_status_dispersion: countDistinctStatuses(statusCounts) > 1,
  }
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
