import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from '~/modules/process/ui/utils/formatRelativeTime'
import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'
import { Instant } from '~/shared/time/instant'

describe('formatRelativeTime', () => {
  const now = Instant.fromIso('2026-02-23T12:00:00.000Z')
  const enUS = new Intl.RelativeTimeFormat('en-US', { numeric: 'always', style: 'short' })
  const ptBR = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'always', style: 'short' })

  it('formats past timestamps using locale', () => {
    expect(formatRelativeTime(Instant.fromIso('2026-02-23T11:45:00.000Z'), now, 'en-US')).toBe(
      enUS.format(-15, 'minute'),
    )
    expect(formatRelativeTime(Instant.fromIso('2026-02-23T10:00:00.000Z'), now, 'en-US')).toBe(
      enUS.format(-2, 'hour'),
    )
    expect(formatRelativeTime(Instant.fromIso('2026-02-20T12:00:00.000Z'), now, 'en-US')).toBe(
      enUS.format(-3, 'day'),
    )
  })

  it('formats future timestamps using locale', () => {
    expect(formatRelativeTime(Instant.fromIso('2026-02-23T12:15:00.000Z'), now, 'en-US')).toBe(
      enUS.format(15, 'minute'),
    )
    expect(formatRelativeTime(Instant.fromIso('2026-02-23T14:00:00.000Z'), now, 'en-US')).toBe(
      enUS.format(2, 'hour'),
    )
    expect(formatRelativeTime(Instant.fromIso('2026-02-26T12:00:00.000Z'), now, 'en-US')).toBe(
      enUS.format(3, 'day'),
    )
  })

  it('supports non-English locale formatting', () => {
    expect(formatRelativeTime(Instant.fromIso('2026-02-23T11:45:00.000Z'), now, 'pt-BR')).toBe(
      ptBR.format(-15, 'minute'),
    )
    expect(formatRelativeTime(Instant.fromIso('2026-02-23T12:15:00.000Z'), now, 'pt-BR')).toBe(
      ptBR.format(15, 'minute'),
    )
  })

  it('uses DEFAULT_LOCALE when locale is omitted', () => {
    const target = Instant.fromIso('2026-02-23T11:45:00.000Z')

    expect(formatRelativeTime(target, now)).toBe(formatRelativeTime(target, now, DEFAULT_LOCALE))
  })
})
