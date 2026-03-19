import type { CalendarDate } from '~/shared/time/calendar-date'
import type { Instant } from '~/shared/time/instant'
import type { TemporalValue } from '~/shared/time/temporal-value'

export type TemporalBoundaryStrategy = 'start-of-day' | 'end-of-day'

type CompareTemporalOptions = {
  readonly timezone: string
  readonly strategy: TemporalBoundaryStrategy
}

export function toComparableInstant(value: TemporalValue, options: CompareTemporalOptions) {
  if (value.kind === 'instant') return value.value

  if (options.strategy === 'start-of-day') {
    return value.value.startOfDay(options.timezone)
  }

  return value.value.endOfDay(options.timezone)
}

export function compareTemporal(
  a: TemporalValue,
  b: TemporalValue,
  options: CompareTemporalOptions,
): number {
  if (a.kind === 'instant' && b.kind === 'instant') {
    return a.value.compare(b.value)
  }

  if (a.kind === 'date' && b.kind === 'date') {
    return a.value.compare(b.value)
  }

  return toComparableInstant(a, options).compare(toComparableInstant(b, options))
}

export function isInstantInCalendarDate(
  instant: Instant,
  date: CalendarDate,
  timezone: string,
): boolean {
  const instantDate = instant.toCalendarDate(timezone)
  return instantDate.equals(date)
}
