import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'
import { i18n } from '~/shared/localization/i18n'
import { formatTemporalDate } from '~/shared/time/temporal-formatters'

export function formatDateForLocale(input: string, locale?: string): string {
  const lng = locale ?? i18n.language ?? DEFAULT_LOCALE
  return formatTemporalDate(input.trim(), lng)
}
