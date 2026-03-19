import { getBrowserTimezone } from '~/shared/time/browser-timezone'
import type { CalendarDate } from '~/shared/time/calendar-date'
import { systemClock } from '~/shared/time/clock'
import type { TemporalValueDto } from '~/shared/time/dto'
import { isTemporalValue, isTemporalValueDto } from '~/shared/time/guards'
import type { Instant } from '~/shared/time/instant'
import { parseTemporalValue } from '~/shared/time/parsing'
import type { TemporalValue } from '~/shared/time/temporal-value'

type FormatterInput = TemporalValue | TemporalValueDto

function toTemporalValue(input: FormatterInput): TemporalValue | null {
  if (isTemporalValue(input)) return input
  if (isTemporalValueDto(input)) return parseTemporalValue(input)
  return null
}

function formatCalendarDateUtcDate(date: CalendarDate): Date {
  const [yearStr, monthStr, dayStr] = date.toIsoDate().split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
}

export function formatInstantDate(
  instant: Instant,
  locale: string,
  timezone: string = getBrowserTimezone(),
): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  }).format(new Date(instant.toEpochMs()))
}

export function formatInstantDateTime(
  instant: Instant,
  locale: string,
  timezone: string = getBrowserTimezone(),
): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(instant.toEpochMs()))
}

export function formatCalendarDate(date: CalendarDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(formatCalendarDateUtcDate(date))
}

export function formatTemporalDate(
  input: FormatterInput,
  locale: string,
  timezone: string = getBrowserTimezone(),
): string {
  const parsed = toTemporalValue(input)
  if (!parsed) return ''

  if (parsed.kind === 'instant') {
    return formatInstantDate(parsed.value, locale, timezone)
  }

  return formatCalendarDate(parsed.value, locale)
}

export function formatTemporalDateTime(
  input: FormatterInput,
  locale: string,
  timezone: string = getBrowserTimezone(),
): string {
  const parsed = toTemporalValue(input)
  if (!parsed) return ''

  if (parsed.kind === 'instant') {
    return formatInstantDateTime(parsed.value, locale, timezone)
  }

  return formatCalendarDate(parsed.value, locale)
}

export function formatRelativeInstant(
  targetInstant: Instant,
  now: Instant = systemClock.now(),
  locale: string,
): string {
  const diffMs = targetInstant.toEpochMs() - now.toEpochMs()
  if (!Number.isFinite(diffMs)) return ''

  const absMs = Math.abs(diffMs)
  const diffMinutes = Math.floor(absMs / 60000)
  const diffHours = Math.floor(absMs / 3600000)
  const diffDays = Math.floor(absMs / 86400000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'short' })

  if (absMs < 3600000) {
    return formatter.format(diffMs < 0 ? -diffMinutes : diffMinutes, 'minute')
  }
  if (absMs < 86400000) {
    return formatter.format(diffMs < 0 ? -diffHours : diffHours, 'hour')
  }
  return formatter.format(diffMs < 0 ? -diffDays : diffDays, 'day')
}
