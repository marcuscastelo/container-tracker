import { isCalendarDate } from '~/shared/time/calendar-date'
import type { TemporalValueDto } from '~/shared/time/dto'
import { isInstant } from '~/shared/time/instant'
import type { TemporalValue } from '~/shared/time/temporal-value'

export function isTemporalValue(value: unknown): value is TemporalValue {
  if (typeof value !== 'object' || value === null || !('kind' in value) || !('value' in value)) {
    return false
  }

  if (value.kind === 'instant') return isInstant(value.value)
  if (value.kind === 'date') return isCalendarDate(value.value)
  return false
}

export function isTemporalValueDto(value: unknown): value is TemporalValueDto {
  if (typeof value !== 'object' || value === null || !('kind' in value) || !('value' in value)) {
    return false
  }

  return (value.kind === 'instant' || value.kind === 'date') && typeof value.value === 'string'
}
