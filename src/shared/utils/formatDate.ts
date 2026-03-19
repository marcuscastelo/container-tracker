import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'
import { i18n } from '~/shared/localization/i18n'
import type { TemporalValueDto } from '~/shared/time/dto'
import { parseTemporalValueFromCanonicalString } from '~/shared/time/parsing'
import { formatTemporalDate } from '~/shared/time/temporal-formatters'

export function formatDateForLocale(input: string | TemporalValueDto, locale?: string): string {
  const lng = locale ?? i18n.language ?? DEFAULT_LOCALE
  if (typeof input !== 'string') {
    return formatTemporalDate(input, lng)
  }

  const parsed = parseTemporalValueFromCanonicalString(input.trim())
  return parsed ? formatTemporalDate(parsed, lng) : input
}
