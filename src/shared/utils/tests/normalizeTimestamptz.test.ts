import { describe, expect, it } from 'vitest'
import { normalizeTimestamptz } from '~/shared/utils/normalizeTimestamptz'

describe('normalizeTimestamptz util', () => {
  it('normalizes valid Date objects to canonical ISO strings', () => {
    const date = new Date('2026-01-15T10:00:00.000Z')

    expect(normalizeTimestamptz(date)).toBe('2026-01-15T10:00:00.000Z')
  })

  it('returns null for invalid Date objects', () => {
    const invalidDate = new Date('invalid')

    expect(normalizeTimestamptz(invalidDate)).toBeNull()
  })
})
