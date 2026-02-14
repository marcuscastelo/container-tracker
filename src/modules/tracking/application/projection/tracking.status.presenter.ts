import type { StatusVariant } from '~/shared/ui/StatusBadge'

/**
 * Map domain ContainerStatus (from tracking pipeline) to UI StatusVariant.
 */
export function containerStatusToVariant(status: string | undefined): StatusVariant {
  switch (status) {
    case 'IN_TRANSIT':
      return 'in-transit'
    case 'LOADED':
      return 'loaded'
    case 'ARRIVED_AT_POD':
    case 'DISCHARGED':
    case 'AVAILABLE_FOR_PICKUP':
      return 'released'
    case 'DELIVERED':
    case 'EMPTY_RETURNED':
      return 'delivered'
    case 'IN_PROGRESS':
      return 'pending'
    default:
      return 'unknown'
  }
}

/**
 * Map domain ContainerStatus to a human-readable label.
 */
export function containerStatusLabel(status: string | undefined): string {
  switch (status) {
    case 'IN_TRANSIT':
      return 'In Transit'
    case 'LOADED':
      return 'Loaded'
    case 'ARRIVED_AT_POD':
      return 'Arrived at POD'
    case 'DISCHARGED':
      return 'Discharged'
    case 'AVAILABLE_FOR_PICKUP':
      return 'Available for Pickup'
    case 'DELIVERED':
      return 'Delivered'
    case 'EMPTY_RETURNED':
      return 'Empty Returned'
    case 'IN_PROGRESS':
      return 'In Progress'
    default:
      return 'Awaiting data'
  }
}
