import {
  type OperationalStatus,
  operationalStatusDominanceIndex,
  type ProcessAggregatedStatus,
} from '~/modules/process/application/operational-projection/operationalSemantics'

/**
 * Statuses that indicate the container is still in active movement
 * (not yet at the discharge/destination port).
 */
const PRE_COMPLETION_STATUSES: ReadonlySet<OperationalStatus> = new Set([
  'UNKNOWN',
  'IN_PROGRESS',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED_AT_POD',
])

/**
 * Statuses that indicate the container has reached a final delivery state.
 */
const FINAL_DELIVERY_STATUSES: ReadonlySet<OperationalStatus> = new Set([
  'DELIVERED',
  'EMPTY_RETURNED',
])

function isPreCompletion(status: OperationalStatus): boolean {
  return PRE_COMPLETION_STATUSES.has(status)
}

function isFinalDelivery(status: OperationalStatus): boolean {
  return FINAL_DELIVERY_STATUSES.has(status)
}

/**
 * Derive process-level aggregated status from multiple container statuses.
 *
 * Uses conservative aggregation:
 * - If ANY container is still moving AND some are delivered → PARTIALLY_DELIVERED
 * - If ANY container is still moving → most conservative (lowest) active status
 * - If ALL containers reached post-completion → lowest post-completion status
 *
 * Priority: In transit > Partially delivered > Discharged > Delivered
 *
 * @param statuses - Array of container statuses to aggregate
 * @returns The process-level aggregated status
 */
export function deriveProcessStatusFromContainers(
  statuses: readonly OperationalStatus[],
): ProcessAggregatedStatus {
  if (statuses.length === 0) return 'UNKNOWN'

  const hasPreCompletion = statuses.some(isPreCompletion)
  const hasFinalDelivery = statuses.some(isFinalDelivery)

  if (hasPreCompletion && hasFinalDelivery) {
    return 'PARTIALLY_DELIVERED'
  }

  if (hasPreCompletion) {
    // Return the most conservative (lowest dominance) status — showing the least advanced container
    let lowestStatus: OperationalStatus = statuses[0]
    let lowestIdx = operationalStatusDominanceIndex(statuses[0])

    for (let i = 1; i < statuses.length; i++) {
      const idx = operationalStatusDominanceIndex(statuses[i])
      // Skip UNKNOWN — prefer showing a more informative status if possible
      if (lowestStatus === 'UNKNOWN' || (idx < lowestIdx && statuses[i] !== 'UNKNOWN')) {
        lowestStatus = statuses[i]
        lowestIdx = idx
      }
    }

    return lowestStatus
  }

  // All containers are post-completion: use the lowest (most conservative) post-completion status
  let lowestStatus: OperationalStatus = statuses[0]
  let lowestIdx = operationalStatusDominanceIndex(statuses[0])

  for (let i = 1; i < statuses.length; i++) {
    const idx = operationalStatusDominanceIndex(statuses[i])
    if (idx < lowestIdx) {
      lowestStatus = statuses[i]
      lowestIdx = idx
    }
  }

  return lowestStatus
}
