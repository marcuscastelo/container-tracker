import { describe, expect, it } from 'vitest'

import { requireTimestamptz } from '~/shared/utils/requireTimestamptz'

describe('requireTimestamptz util', () => {
  it('returns normalized ISO when value is parseable', () => {
    expect(
      requireTimestamptz(
        '2026-04-07T12:00:00-03:00',
        'process.created_at',
        'process persistence mapper',
      ),
    ).toBe('2026-04-07T15:00:00.000Z')
  })

  it('throws context-rich error when value is invalid', () => {
    expect(() =>
      requireTimestamptz('invalid', 'tracking.last_updated_at', 'tracking persistence mapper'),
    ).toThrow(
      'tracking persistence mapper: tracking.last_updated_at is not a valid timestamp: invalid',
    )
  })
})
