import { describe, expect, it } from 'vitest'
import { toTrackingTimeTravelResourceKey } from '~/modules/process/ui/screens/shipment/lib/tracking-time-travel.resource-key'

describe('tracking time travel resource key', () => {
  it('returns null when historical mode is inactive or no container is selected', () => {
    expect(
      toTrackingTimeTravelResourceKey({
        isActive: false,
        containerId: 'container-1',
        trackingFreshnessToken: 'token-1',
      }),
    ).toBeNull()

    expect(
      toTrackingTimeTravelResourceKey({
        isActive: true,
        containerId: null,
        trackingFreshnessToken: 'token-1',
      }),
    ).toBeNull()
  })

  it('changes when the tracking freshness token changes so historical syncs refetch after reconciliation', () => {
    expect(
      toTrackingTimeTravelResourceKey({
        isActive: true,
        containerId: 'container-1',
        trackingFreshnessToken: 'token-before',
      }),
    ).toEqual(['container-1', 'token-before'])

    expect(
      toTrackingTimeTravelResourceKey({
        isActive: true,
        containerId: 'container-1',
        trackingFreshnessToken: 'token-after',
      }),
    ).toEqual(['container-1', 'token-after'])
  })
})
