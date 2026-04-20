import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'
import { systemClock } from '~/shared/time/clock'
import type { Instant } from '~/shared/time/instant'
import { formatRelativeInstant } from '~/shared/time/temporal-formatters'

export function formatRelativeTime(
  instant: Instant,
  now: Instant = systemClock.now(),
  locale: string = DEFAULT_LOCALE,
): string {
  return formatRelativeInstant(instant, now, locale)
}
