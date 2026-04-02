import { describe, expect, it } from 'vitest'
import { CalendarDate } from '~/shared/time/calendar-date'
import { compareTemporal, isInstantInCalendarDate } from '~/shared/time/compare-temporal'
import { toTemporalValueDto } from '~/shared/time/dto'
import { Instant } from '~/shared/time/instant'
import {
  parseCalendarDateFromDdMmYyyy,
  parseCalendarDateFromIso,
  parseInstantFromIso,
  parseTemporalValue,
} from '~/shared/time/parsing'
import { formatTemporalDate, formatTemporalDateTime } from '~/shared/time/temporal-formatters'
import { calendarDateValue, instantValue } from '~/shared/time/temporal-value'

describe('shared time temporal semantics', () => {
  it('parses dd/MM/yyyy into CalendarDate without inventing an instant', () => {
    const parsed = parseCalendarDateFromDdMmYyyy('15/02/2026')

    expect(parsed?.toIsoDate()).toBe('2026-02-15')
  })

  it('parses temporal DTOs into the correct semantic kind', () => {
    const parsedDate = parseCalendarDateFromIso('2026-02-15')
    const parsedInstant = parseInstantFromIso('2026-02-15T10:30:00.000Z')

    expect(parsedDate).not.toBeNull()
    expect(parsedInstant).not.toBeNull()

    if (!parsedDate || !parsedInstant) {
      throw new Error('Expected canonical temporal values to parse')
    }

    const dateValue = parseTemporalValue(toTemporalValueDto(calendarDateValue(parsedDate)))
    const instantValueResult = parseTemporalValue(toTemporalValueDto(instantValue(parsedInstant)))

    expect(dateValue?.kind).toBe('date')
    expect(instantValueResult?.kind).toBe('instant')
  })

  it('accepts ISO instants with microsecond precision and normalizes them to milliseconds', () => {
    const parsedViaClass = Instant.fromIso('2026-03-10T07:45:41.017901+00:00')
    const parsedViaHelper = parseInstantFromIso('2026-03-10T07:45:41.017901+00:00')

    expect(parsedViaHelper?.toIsoString()).toBe('2026-03-10T07:45:41.017Z')
    expect(parsedViaClass.toIsoString()).toBe('2026-03-10T07:45:41.017Z')
  })

  it('compares CalendarDate against Instant with explicit strategy', () => {
    const date = parseTemporalValue({
      kind: 'date',
      value: '2026-02-15',
    })
    const earlyInstant = parseTemporalValue({
      kind: 'instant',
      value: '2026-02-15T08:00:00.000Z',
    })

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
    expect(formatTemporalDate({ kind: 'date', value: '2026-02-15' }, 'en-US')).toBe('02/15/2026')
  })

  it('keeps DATE_ONLY rendering stable across browser timezones', () => {
    const value = { kind: 'date', value: '2026-04-24' } as const

    expect(formatTemporalDate(value, 'pt-BR', 'America/Sao_Paulo')).toBe('24/04/2026')
    expect(formatTemporalDate(value, 'pt-BR', 'UTC')).toBe('24/04/2026')
    expect(formatTemporalDate(value, 'pt-BR', 'Europe/Berlin')).toBe('24/04/2026')
  })

  it('formats instants with time while keeping calendar dates date-only', () => {
    expect(
      formatTemporalDateTime(
        { kind: 'instant', value: '2026-02-15T13:45:00.000Z' },
        'en-US',
        'UTC',
      ),
    ).toContain('02/15/2026')

    expect(formatTemporalDateTime({ kind: 'date', value: '2026-02-15' }, 'en-US')).toBe(
      '02/15/2026',
    )
  })

  it('renders LOCAL_DATETIME using the event timezone instead of the browser timezone', () => {
    const value = {
      kind: 'local-datetime',
      value: '2026-04-24T19:00:00.000',
      timezone: 'America/Sao_Paulo',
    } as const

    expect(formatTemporalDate(value, 'pt-BR', 'UTC')).toBe('24/04/2026')
    expect(formatTemporalDate(value, 'pt-BR', 'Europe/Berlin')).toBe('24/04/2026')
    expect(formatTemporalDateTime(value, 'pt-BR', 'UTC')).toContain('19:00')
    expect(formatTemporalDateTime(value, 'pt-BR', 'Europe/Berlin')).toContain('19:00')
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
