import { describe, expect, it } from 'vitest'

import { computeBackoffDelayMs, ENROLL_BACKOFF_CONFIG } from '~/../tools/agent/backoff'

describe('agent enroll backoff', () => {
  it('follows exponential growth with cap (without jitter)', () => {
    const randomValueWithoutJitter = 0.5

    const observed = [
      computeBackoffDelayMs(0, { randomValue: randomValueWithoutJitter }),
      computeBackoffDelayMs(1, { randomValue: randomValueWithoutJitter }),
      computeBackoffDelayMs(2, { randomValue: randomValueWithoutJitter }),
      computeBackoffDelayMs(3, { randomValue: randomValueWithoutJitter }),
      computeBackoffDelayMs(4, { randomValue: randomValueWithoutJitter }),
      computeBackoffDelayMs(5, { randomValue: randomValueWithoutJitter }),
      computeBackoffDelayMs(6, { randomValue: randomValueWithoutJitter }),
      computeBackoffDelayMs(7, { randomValue: randomValueWithoutJitter }),
    ]

    expect(observed).toEqual([5000, 10000, 20000, 40000, 80000, 160000, 300000, 300000])
  })

  it('applies +-20% jitter bounds', () => {
    const attempt = 2
    const baseDelay = ENROLL_BACKOFF_CONFIG.baseMs * ENROLL_BACKOFF_CONFIG.factor ** attempt
    const expectedMaxDelta = baseDelay * ENROLL_BACKOFF_CONFIG.jitterRatio

    const minDelay = computeBackoffDelayMs(attempt, { randomValue: 0 })
    const maxDelay = computeBackoffDelayMs(attempt, { randomValue: 1 })

    expect(minDelay).toBe(baseDelay - expectedMaxDelta)
    expect(maxDelay).toBe(baseDelay + expectedMaxDelta)
  })
})
