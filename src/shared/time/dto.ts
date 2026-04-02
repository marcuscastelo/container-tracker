import type { CalendarDate } from '~/shared/time/calendar-date'
import type { Instant } from '~/shared/time/instant'
import type { LocalDateTime } from '~/shared/time/local-date-time'
import type { TemporalValue } from '~/shared/time/temporal-value'

export type InstantDto = { readonly kind: 'instant'; readonly value: string }
export type CalendarDateDto = {
  readonly kind: 'date'
  readonly value: string
  readonly timezone?: string | null | undefined
}
export type LocalDateTimeDto = {
  readonly kind: 'local-datetime'
  readonly value: string
  readonly timezone: string
}
export type TemporalValueDto = InstantDto | CalendarDateDto | LocalDateTimeDto

export function toInstantDto(value: Instant): InstantDto {
  return {
    kind: 'instant',
    value: value.toIsoString(),
  }
}

function toCalendarDateDto(value: CalendarDate, timezone: string | null): CalendarDateDto {
  return {
    kind: 'date',
    value: value.toIsoDate(),
    timezone,
  }
}

function toLocalDateTimeDto(value: LocalDateTime): LocalDateTimeDto {
  return {
    kind: 'local-datetime',
    value: value.toIsoLocalString(),
    timezone: value.timezone,
  }
}

export function toTemporalValueDto(value: TemporalValue): TemporalValueDto {
  if (value.kind === 'instant') {
    return toInstantDto(value.value)
  }

  if (value.kind === 'date') {
    return toCalendarDateDto(value.value, value.timezone)
  }

  return toLocalDateTimeDto(value.value)
}
