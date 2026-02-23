import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from '~/modules/process/ui/utils/formatRelativeTime'

describe('formatRelativeTime', () => {
  const now = new Date('2026-02-23T12:00:00.000Z')

  it('formats past timestamps as ago', () => {
    expect(formatRelativeTime('2026-02-23T11:45:00.000Z', now)).toBe('15m ago')
    expect(formatRelativeTime('2026-02-23T10:00:00.000Z', now)).toBe('2h ago')
    expect(formatRelativeTime('2026-02-20T12:00:00.000Z', now)).toBe('3d ago')
  })

  it('formats future timestamps as in X', () => {
    expect(formatRelativeTime('2026-02-23T12:15:00.000Z', now)).toBe('in 15m')
    expect(formatRelativeTime('2026-02-23T14:00:00.000Z', now)).toBe('in 2h')
    expect(formatRelativeTime('2026-02-26T12:00:00.000Z', now)).toBe('in 3d')
  })

  it('returns empty string for invalid date', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('')
  })
})
