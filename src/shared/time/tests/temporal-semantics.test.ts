import { describe, expect, it } from 'vitest'
import { CalendarDate } from '~/shared/time/calendar-date'
import { compareTemporal, isInstantInCalendarDate } from '~/shared/time/compare-temporal'
import { Instant } from '~/shared/time/instant'
import { parseCalendarDateFromDdMmYyyy, parseTemporalValue } from '~/shared/time/parsing'
import { formatTemporalDate } from '~/shared/time/temporal-formatters'
import { instantValue } from '~/shared/time/temporal-value'

describe('shared time temporal semantics', () => {
  it('parses dd/MM/yyyy into CalendarDate without inventing an instant', () => {
    const parsed = parseCalendarDateFromDdMmYyyy('15/02/2026')

    expect(parsed?.toIsoDate()).toBe('2026-02-15')
  })

  it('parses legacy temporal strings into the correct semantic kind', () => {
    const dateValue = parseTemporalValue('2026-02-15')
    const instantValueResult = parseTemporalValue('2026-02-15T10:30:00.000Z')

    expect(dateValue?.kind).toBe('date')
    expect(instantValueResult?.kind).toBe('instant')
  })

  it('compares CalendarDate against Instant with explicit strategy', () => {
    const date = parseTemporalValue('2026-02-15')
    const earlyInstant = parseTemporalValue('2026-02-15T08:00:00.000Z')

    expect(date).not.toBeNull()
    expect(earlyInstant).not.toBeNull()

    if (!date || !earlyInstant) {
      throw new Error('Expected temporal values to parse')
    }

    expect(
      compareTemporal(date, earlyInstant, {
        timezone: 'UTC',
        strategy: 'start-of-day',
      }),
    ).toBeLessThan(0)

    expect(
      compareTemporal(date, earlyInstant, {
        timezone: 'UTC',
        strategy: 'end-of-day',
      }),
    ).toBeGreaterThan(0)
  })

  it('checks instant membership inside a calendar day with explicit timezone', () => {
    const instant = Instant.fromIso('2026-02-15T23:30:00.000Z')
    const date = CalendarDate.fromIsoDate('2026-02-15')

    expect(isInstantInCalendarDate(instant, date, 'UTC')).toBe(true)
  })

  it('formats calendar dates without shifting the rendered day', () => {
    expect(formatTemporalDate('2026-02-15', 'en-US')).toBe('02/15/2026')
  })

  it('keeps explicit instant wrappers usable in comparisons', () => {
    const left = instantValue(Instant.fromIso('2026-02-15T00:00:00.000Z'))
    const right = instantValue(Instant.fromIso('2026-02-16T00:00:00.000Z'))

    expect(
      compareTemporal(left, right, {
        timezone: 'UTC',
        strategy: 'start-of-day',
      }),
    ).toBeLessThan(0)
  })
})
