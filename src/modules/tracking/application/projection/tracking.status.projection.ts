import {
  CONTAINER_STATUSES,
  type ContainerStatus,
} from '~/modules/tracking/domain/model/containerStatus'

export const TRACKING_STATUS_CODES: readonly ContainerStatus[] = CONTAINER_STATUSES

export type TrackingStatusCode = ContainerStatus

function isTrackingStatusCode(value: string): value is TrackingStatusCode {
  return CONTAINER_STATUSES.some((status) => status === value)
}

export function toTrackingStatusCode(status: string | null | undefined): TrackingStatusCode {
  if (!status) return 'UNKNOWN'
  return isTrackingStatusCode(status) ? status : 'UNKNOWN'
}
