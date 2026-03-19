import {
  type TrackingReplayDebugResponseDto,
  TrackingReplayDebugResponseDtoSchema,
} from '~/modules/tracking/interface/http/tracking.schemas'
import { typedFetch } from '~/shared/api/typedFetch'

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
