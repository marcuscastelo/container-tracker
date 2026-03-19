import type { CalendarDate } from '~/shared/time/calendar-date'
import type { Instant } from '~/shared/time/instant'

export type TemporalValue =
  | { readonly kind: 'instant'; readonly value: Instant }
  | { readonly kind: 'date'; readonly value: CalendarDate }

export function instantValue(value: Instant): TemporalValue {
  return { kind: 'instant', value }
}

export function calendarDateValue(value: CalendarDate): TemporalValue {
  return { kind: 'date', value }
}
