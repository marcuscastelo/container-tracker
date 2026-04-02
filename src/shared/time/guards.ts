import { isCalendarDate } from '~/shared/time/calendar-date'
import type { TemporalValueDto } from '~/shared/time/dto'
import { isInstant } from '~/shared/time/instant'
import { isLocalDateTime } from '~/shared/time/local-date-time'
import type { TemporalValue } from '~/shared/time/temporal-value'

export function isTemporalValue(value: unknown): value is TemporalValue {
  if (typeof value !== 'object' || value === null || !('kind' in value) || !('value' in value)) {
    return false
  }

  if (value.kind === 'instant') return isInstant(value.value)
  if (value.kind === 'date') {
    const timezone = 'timezone' in value ? value.timezone : undefined
    return (
      isCalendarDate(value.value) &&
      (timezone === null || timezone === undefined || typeof timezone === 'string')
    )
  }
  if (value.kind === 'local-datetime') return isLocalDateTime(value.value)
  return false
}

export function isTemporalValueDto(value: unknown): value is TemporalValueDto {
  if (typeof value !== 'object' || value === null || !('kind' in value) || !('value' in value)) {
    return false
  }

  if (value.kind === 'instant') {
    return typeof value.value === 'string'
  }

  if (value.kind === 'date') {
    const timezone = 'timezone' in value ? value.timezone : undefined
    return (
      typeof value.value === 'string' &&
      (timezone === null || timezone === undefined || typeof timezone === 'string')
    )
  }

  if (value.kind === 'local-datetime') {
    return (
      typeof value.value === 'string' && 'timezone' in value && typeof value.timezone === 'string'
    )
  }

  return false
}
