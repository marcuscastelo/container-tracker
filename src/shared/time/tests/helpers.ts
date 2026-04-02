import { type TemporalValueDto, toTemporalValueDto } from '~/shared/time/dto'
import { Instant } from '~/shared/time/instant'
import { parseTemporalValueDto, parseTemporalValueFromCanonicalString } from '~/shared/time/parsing'
import type { TemporalValue } from '~/shared/time/temporal-value'

export function instantFromIsoText(value: string | Instant): Instant {
  return typeof value === 'string' ? Instant.fromIso(value) : value
}

export function temporalValueFromCanonical(value: string): TemporalValue {
  const parsed = parseTemporalValueFromCanonicalString(value)
  if (parsed === null) {
    throw new Error(`Invalid canonical temporal value in test helper: ${value}`)
  }

  return parsed
}

export function temporalDtoFromCanonical(value: string): TemporalValueDto {
  return toTemporalValueDto(temporalValueFromCanonical(value))
}

export function resolveTemporalValue(
  value: string | TemporalValue | null | undefined,
  fallback: TemporalValue | null,
): TemporalValue | null {
  if (value === undefined) return fallback
  if (value === null) return null
  return typeof value === 'string' ? temporalValueFromCanonical(value) : value
}

export function resolveTemporalDto(
  value: string | TemporalValueDto | null | undefined,
  fallback: TemporalValueDto | null,
): TemporalValueDto | null {
  if (value === undefined) return fallback
  if (value === null) return null
  return typeof value === 'string' ? temporalDtoFromCanonical(value) : value
}

export function temporalCanonicalText(
  value: TemporalValue | TemporalValueDto | null,
): string | null {
  if (value === null) return null
  if (value.kind === 'instant') {
    return typeof value.value === 'string' ? value.value : value.value.toIsoString()
  }

  if (value.kind === 'local-datetime') {
    const timezone = 'timezone' in value ? value.timezone : value.value.timezone
    const localValue =
      typeof value.value === 'string' ? value.value : value.value.toIsoLocalString()
    return `${localValue}[${timezone}]`
  }

  if (typeof value.value === 'string') {
    if (value.timezone === null || value.timezone === undefined) {
      return value.value
    }

    return `${value.value}[${value.timezone}]`
  }

  if (value.timezone === null || value.timezone === undefined) {
    return value.value.toIsoDate()
  }

  return `${value.value.toIsoDate()}[${value.timezone}]`
}

export function temporalValueFromDto(value: TemporalValueDto | null): TemporalValue | null {
  if (value === null) return null
  const parsed = parseTemporalValueDto(value)
  if (parsed === null) {
    throw new Error(`Invalid temporal DTO in test helper: ${value.kind}:${value.value}`)
  }

  return parsed
}
