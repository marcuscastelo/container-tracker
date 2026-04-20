import { describe, expect, it } from 'vitest'
import type {
  TrackingReplayDebugResponseDto,
  TrackingTimeTravelResponseDto,
} from '~/modules/process/ui/api/tracking-time-travel.api'
import {
  toTrackingReplayDebugValue,
  toTrackingTimeTravelValue,
} from '~/modules/process/ui/screens/shipment/hooks/useTrackingTimeTravelController'

function buildErroredResource<T>(): {
  readonly state: 'errored'
  readonly latest: T | undefined
} {
  return {
    state: 'errored',
    get latest(): never {
      throw new Error('tracking time-travel resource latest should not be read')
    },
  }
}

describe('useTrackingTimeTravelController helpers', () => {
  it('returns null for time-travel value when the resource is errored', () => {
    const resource = buildErroredResource<TrackingTimeTravelResponseDto>()

    expect(toTrackingTimeTravelValue(resource, 'pt-BR')).toBeNull()
  })

  it('returns null for debug value when the resource is errored', () => {
    const resource = buildErroredResource<TrackingReplayDebugResponseDto>()

    expect(toTrackingReplayDebugValue(resource, 'pt-BR')).toBeNull()
  })
})
