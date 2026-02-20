import {
  type OperationalStatus,
  operationalStatusDominanceIndex,
} from '~/modules/process/application/operational-projection/operationalSemantics'

/**
 * Derive the highest-dominance status from multiple container statuses.
 *
 * Uses the canonical dominance order from the tracking domain.
 * This function lives in the Application layer so both the Dashboard
 * projection and the Shipment View can share the same logic.
 *
 * @param statuses - Array of container statuses to aggregate
 * @returns The highest-dominance ContainerStatus
 */
export function deriveProcessStatusFromContainers(
  statuses: readonly OperationalStatus[],
): OperationalStatus {
  let highest: OperationalStatus = 'UNKNOWN'
  let highestIdx = 0

  for (const s of statuses) {
    const idx = operationalStatusDominanceIndex(s)
    if (idx > highestIdx) {
      highest = s
      highestIdx = idx
    }
  }

  return highest
}
