import { i18n } from '~/shared/localization/i18n'

/**
 * Format a Date or ISO date string according to a locale using day/month/year
 * or month/day/year depending on locale. Uses Intl.DateTimeFormat with
 * two-digit day/month and numeric year to respect locale conventions.
 */
export function formatDateForLocale(input: string | Date, locale?: string): string {
  const date = input instanceof Date ? input : new Date(input)
  // If invalid date, return empty string
  if (Number.isNaN(date.getTime())) return ''

  const lng = locale ?? i18n.language ?? 'en-US'
  return new Intl.DateTimeFormat(lng, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    date,
  )
}
