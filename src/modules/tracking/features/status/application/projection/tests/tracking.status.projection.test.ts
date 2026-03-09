import { describe, expect, it } from 'vitest'
import {
  TRACKING_STATUS_CODES,
  toTrackingStatusCode,
} from '~/modules/tracking/features/status/application/projection/tracking.status.projection'
import { CONTAINER_STATUSES } from '~/modules/tracking/features/status/domain/model/containerStatus'

describe('toTrackingStatusCode', () => {
  it('reuses canonical status codes from tracking domain', () => {
    expect(TRACKING_STATUS_CODES).toEqual(CONTAINER_STATUSES)
  })

  it('maps known status values as-is', () => {
    expect(toTrackingStatusCode('IN_TRANSIT')).toBe('IN_TRANSIT')
    expect(toTrackingStatusCode('DELIVERED')).toBe('DELIVERED')
  })

  it('defaults unknown/nullish values to UNKNOWN', () => {
    expect(toTrackingStatusCode('SOMETHING_ELSE')).toBe('UNKNOWN')
    expect(toTrackingStatusCode(null)).toBe('UNKNOWN')
    expect(toTrackingStatusCode(undefined)).toBe('UNKNOWN')
  })
})
