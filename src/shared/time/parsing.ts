import { CalendarDate } from '~/shared/time/calendar-date'
import type { TemporalValueDto } from '~/shared/time/dto'
import { isTemporalValueDto } from '~/shared/time/guards'
import { Instant } from '~/shared/time/instant'
import { ISO_LOCAL_DATE_TIME_PATTERN, LocalDateTime } from '~/shared/time/local-date-time'
import {
  calendarDateValue,
  instantValue,
  localDateTimeValue,
  type TemporalValue,
} from '~/shared/time/temporal-value'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MS_DATE_PATTERN = /\/Date\((-?\d+)\)\//
const DD_MM_YYYY_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
const CANONICAL_LOCAL_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?\[.+\]$/

function parseWithFactory<T>(factory: () => T): T | null {
  try {
    return factory()
  } catch {
    return null
  }
}

export function parseInstantFromIso(input: string): Instant | null {
  return parseWithFactory(() => Instant.fromIso(input))
}

export function parseInstantFromTimestampText(input: string): Instant | null {
  const parsedIso = parseInstantFromIso(input)
  if (parsedIso) return parsedIso

  const epochMs = Date.parse(input)
  if (!Number.isFinite(epochMs)) return null
  return parseWithFactory(() => Instant.fromEpochMs(epochMs))
}

export function parseInstantFromMsDate(input: string): Instant | null {
  const match = input.match(MS_DATE_PATTERN)
  if (!match || match[1] === undefined) return null

  const epochMs = Number(match[1])
  if (!Number.isFinite(epochMs)) return null

  return parseWithFactory(() => Instant.fromEpochMs(epochMs))
}

export function parseInstantFromNumber(input: number): Instant | null {
  if (!Number.isFinite(input)) return null
  return parseWithFactory(() => Instant.fromEpochMs(input))
}

export function parseCalendarDateFromIso(input: string): CalendarDate | null {
  if (!ISO_DATE_PATTERN.test(input)) return null
  return parseWithFactory(() => CalendarDate.fromIsoDate(input))
}

export function parseLocalDateTimeFromIso(input: string, timezone: string): LocalDateTime | null {
  if (!ISO_LOCAL_DATE_TIME_PATTERN.test(input)) return null
  return parseWithFactory(() => LocalDateTime.fromIsoLocal(input, timezone))
}

export function parseLocalDateTimeFromCanonicalString(input: string): LocalDateTime | null {
  if (!CANONICAL_LOCAL_DATE_TIME_PATTERN.test(input)) return null
  return parseWithFactory(() => LocalDateTime.fromCanonicalString(input))
}

export function parseCalendarDateFromDdMmYyyy(input: string): CalendarDate | null {
  const match = input.match(DD_MM_YYYY_PATTERN)
  if (!match) return null

  const [, dayPart, monthPart, yearPart] = match
  if (dayPart === undefined || monthPart === undefined || yearPart === undefined) return null

  const day = Number(dayPart)
  const month = Number(monthPart)
  const year = Number(yearPart)

  return parseWithFactory(() =>
    CalendarDate.fromIsoDate(
      `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(
        2,
        '0',
      )}`,
    ),
  )
}

export function parseTemporalValueDto(input: TemporalValueDto): TemporalValue | null {
  if (input.kind === 'instant') {
    const instant = parseInstantFromIso(input.value)
    return instant ? instantValue(instant) : null
  }

  if (input.kind === 'local-datetime') {
    const localDateTime = parseLocalDateTimeFromIso(input.value, input.timezone)
    return localDateTime ? localDateTimeValue(localDateTime) : null
  }

  const calendarDate = parseCalendarDateFromIso(input.value)
  return calendarDate ? calendarDateValue(calendarDate, input.timezone ?? null) : null
}

export function parseTemporalValueFromCanonicalString(input: string): TemporalValue | null {
  const calendarDate = parseCalendarDateFromIso(input)
  if (calendarDate) return calendarDateValue(calendarDate)

  const localDateTime = parseLocalDateTimeFromCanonicalString(input)
  if (localDateTime) return localDateTimeValue(localDateTime)

  const instant = parseInstantFromIso(input)
  if (instant) return instantValue(instant)

  return null
}

export function parseTemporalValue(input: TemporalValueDto): TemporalValue | null {
  if (!isTemporalValueDto(input)) return null
  return parseTemporalValueDto(input)
}
