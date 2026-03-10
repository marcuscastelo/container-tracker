import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'
import { i18n } from '~/shared/localization/i18n'

/**
 * Format a Date or ISO date string according to a locale using day/month/year
 * or month/day/year depending on locale. When the input represents a "date-only"
 * value (YYYY-MM-DD or YYYY-MM-DDT00:00:00 with optional Z/offset) we MUST
 * ignore timezone offsets — the date is a calendar date, not a zoned instant.
 * To accomplish that we format using UTC for date-only values so local TZ
 * does not roll the day backward/forward.
 */
export function formatDateForLocale(input: string | Date, locale?: string): string {
  const lng = locale ?? i18n.language ?? DEFAULT_LOCALE

  // If given a Date instance, detect if it's a pure-midnight date (00:00:00)
  // and treat as date-only. Otherwise format normally.
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return ''
    const isMidnightUTC =
      input.getUTCHours() === 0 && input.getUTCMinutes() === 0 && input.getUTCSeconds() === 0
    if (isMidnightUTC) {
      // Format using UTC timezone so local TZ doesn't change the calendar day
      return new Intl.DateTimeFormat(lng, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(input)
    }

    return new Intl.DateTimeFormat(lng, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(input)
  }

  // input is a string. Try to detect date-only patterns.
  //  - YYYY-MM-DD
  //  - YYYY-MM-DDT00:00:00
  //  - YYYY-MM-DDT00:00:00Z or with offset
  const asStr = input.trim()

  // Exact date-only
  const dateOnlyMatch = asStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch
    const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
    return new Intl.DateTimeFormat(lng, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dt)
  }

  // Midnight datetime (00:00:00) with optional Z or offset
  const midnightMatch = asStr.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:Z|[+-]\d{2}:?\d{2})?$/)
  if (midnightMatch) {
    const [, datePart] = midnightMatch
    const [y, m, d] = datePart.split('-').map((s) => Number(s))
    const dt = new Date(Date.UTC(y, m - 1, d))
    return new Intl.DateTimeFormat(lng, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dt)
  }

  // Fallback: parse as runtime Date and format normally (this will apply TZ)
  const parsed = new Date(asStr)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat(lng, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    parsed,
  )
}
