import type { CalendarDate } from '~/shared/time/calendar-date'
import type { Instant } from '~/shared/time/instant'
import type { LocalDateTime } from '~/shared/time/local-date-time'

export type TemporalValue =
  | { readonly kind: 'instant'; readonly value: Instant }
  | { readonly kind: 'date'; readonly value: CalendarDate; readonly timezone: string | null }
  | { readonly kind: 'local-datetime'; readonly value: LocalDateTime }

export function instantValue(value: Instant): TemporalValue {
  return { kind: 'instant', value }
}

export function calendarDateValue(
  value: CalendarDate,
  timezone: string | null = null,
): TemporalValue {
  return { kind: 'date', value, timezone }
}

export function localDateTimeValue(value: LocalDateTime): TemporalValue {
  return { kind: 'local-datetime', value }
}
