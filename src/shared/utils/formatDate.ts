import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'
import type { TemporalValueDto } from '~/shared/time/dto'
import { parseTemporalValueFromCanonicalString } from '~/shared/time/parsing'
import { formatTemporalDate } from '~/shared/time/temporal-formatters'

export function formatDateForLocale(input: string | TemporalValueDto, locale?: string): string {
  const lng = locale ?? DEFAULT_LOCALE
  if (typeof input !== 'string') {
    return formatTemporalDate(input, lng)
  }

  const parsed = parseTemporalValueFromCanonicalString(input.trim())
  return parsed ? formatTemporalDate(parsed, lng) : input
}
