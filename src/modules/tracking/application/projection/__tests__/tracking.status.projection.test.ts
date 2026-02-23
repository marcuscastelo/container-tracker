import { describe, expect, it } from 'vitest'
import { toTrackingStatusCode } from '~/modules/tracking/application/projection/tracking.status.projection'

describe('toTrackingStatusCode', () => {
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
