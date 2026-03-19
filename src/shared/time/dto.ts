import type { CalendarDate } from '~/shared/time/calendar-date'
import type { Instant } from '~/shared/time/instant'
import type { TemporalValue } from '~/shared/time/temporal-value'

export type InstantDto = { readonly kind: 'instant'; readonly value: string }
export type CalendarDateDto = { readonly kind: 'date'; readonly value: string }
export type TemporalValueDto = InstantDto | CalendarDateDto

export function toInstantDto(value: Instant): InstantDto {
  return {
    kind: 'instant',
    value: value.toIsoString(),
  }
}

export function toCalendarDateDto(value: CalendarDate): CalendarDateDto {
  return {
    kind: 'date',
    value: value.toIsoDate(),
  }
}

export function toTemporalValueDto(value: TemporalValue): TemporalValueDto {
  return value.kind === 'instant' ? toInstantDto(value.value) : toCalendarDateDto(value.value)
}
