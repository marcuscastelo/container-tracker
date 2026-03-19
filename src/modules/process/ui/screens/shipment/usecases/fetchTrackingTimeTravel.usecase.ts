import {
  type TrackingTimeTravelResponseDto,
  TrackingTimeTravelResponseDtoSchema,
} from '~/modules/tracking/interface/http/tracking.schemas'
import { typedFetch } from '~/shared/api/typedFetch'

export async function fetchTrackingTimeTravel(
  containerId: string,
): Promise<TrackingTimeTravelResponseDto> {
  return typedFetch(
    `/api/tracking/containers/${containerId}/time-travel`,
    undefined,
    TrackingTimeTravelResponseDtoSchema,
  )
}
