import {
  type ContainerStatus,
  statusDominanceIndex,
} from '~/modules/tracking/domain/model/containerStatus'

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
  statuses: readonly ContainerStatus[],
): ContainerStatus {
  let highest: ContainerStatus = 'UNKNOWN'
  let highestIdx = 0

  for (const s of statuses) {
    const idx = statusDominanceIndex(s)
    if (idx > highestIdx) {
      highest = s
      highestIdx = idx
    }
  }

  return highest
}
