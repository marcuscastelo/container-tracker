export const TRACKING_STATUS_CODES = [
  'UNKNOWN',
  'IN_PROGRESS',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED_AT_POD',
  'DISCHARGED',
  'AVAILABLE_FOR_PICKUP',
  'DELIVERED',
  'EMPTY_RETURNED',
] as const

export type TrackingStatusCode = (typeof TRACKING_STATUS_CODES)[number]

export function toTrackingStatusCode(status: string | null | undefined): TrackingStatusCode {
  switch (status) {
    case 'IN_PROGRESS':
    case 'LOADED':
    case 'IN_TRANSIT':
    case 'ARRIVED_AT_POD':
    case 'DISCHARGED':
    case 'AVAILABLE_FOR_PICKUP':
    case 'DELIVERED':
    case 'EMPTY_RETURNED':
      return status
    default:
      return 'UNKNOWN'
  }
}
