import { compareTemporal } from '~/shared/time/compare-temporal'
import { type TemporalValueDto, toTemporalValueDto } from '~/shared/time/dto'
import type { Instant } from '~/shared/time/instant'
import { instantValue, type TemporalValue } from '~/shared/time/temporal-value'

export const TRACKING_UTC_TIMEZONE = 'UTC' as const

export const TRACKING_CHRONOLOGY_COMPARE_OPTIONS = {
  timezone: TRACKING_UTC_TIMEZONE,
  strategy: 'start-of-day',
} as const

export const TRACKING_EXPIRATION_COMPARE_OPTIONS = {
  timezone: TRACKING_UTC_TIMEZONE,
  strategy: 'end-of-day',
} as const

export function trackingTemporalValueToDto(value: TemporalValue | null): TemporalValueDto | null {
  if (value === null) return null
  return toTemporalValueDto(value)
}

export function compareTrackingTemporalValues(
  left: TemporalValue | null,
  right: TemporalValue | null,
): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return compareTemporal(left, right, TRACKING_CHRONOLOGY_COMPARE_OPTIONS)
}

export function isTrackingTemporalValueExpired(value: TemporalValue | null, now: Instant): boolean {
  if (value === null) return false
  return compareTemporal(value, instantValue(now), TRACKING_EXPIRATION_COMPARE_OPTIONS) < 0
}
