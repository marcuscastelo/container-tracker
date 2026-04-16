import { describe, expect, it } from 'vitest'
import { digestTrackingValidationFingerprint } from '~/modules/tracking/features/validation/domain/services/trackingValidationFingerprint'

describe('digestTrackingValidationFingerprint', () => {
  it('returns the same digest for the same ordered parts', () => {
    const parts = ['CONFLICTING_CRITICAL_ACTUALS', 'fp-1', 'fp-2']

    expect(digestTrackingValidationFingerprint(parts)).toBe(
      digestTrackingValidationFingerprint(parts),
    )
  })

  it('distinguishes part arrays that would collide under delimiter-based joins', () => {
    const digestWithEmbeddedDelimiter = digestTrackingValidationFingerprint(['A|B', 'C'])
    const digestWithSplitDelimiter = digestTrackingValidationFingerprint(['A', 'B|C'])

    expect(digestWithEmbeddedDelimiter).not.toBe(digestWithSplitDelimiter)
  })
})
