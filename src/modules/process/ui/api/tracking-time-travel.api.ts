import {
  type TrackingReplayDebugResponseDto,
  TrackingReplayDebugResponseDtoSchema,
  type TrackingTimeTravelResponseDto,
  TrackingTimeTravelResponseDtoSchema,
} from '~/modules/tracking/interface/http/tracking.schemas'
import { typedFetch } from '~/shared/api/typedFetch'

export type { TrackingReplayDebugResponseDto, TrackingTimeTravelResponseDto }

export async function fetchTrackingTimeTravel(
  containerId: string,
): Promise<TrackingTimeTravelResponseDto> {
  return typedFetch(
    `/api/tracking/containers/${containerId}/time-travel`,
    undefined,
    TrackingTimeTravelResponseDtoSchema,
  )
}

export async function fetchTrackingReplayDebug(
  containerId: string,
  snapshotId: string,
): Promise<TrackingReplayDebugResponseDto> {
  return typedFetch(
    `/api/tracking/containers/${containerId}/time-travel/${snapshotId}/debug`,
    undefined,
    TrackingReplayDebugResponseDtoSchema,
  )
}
