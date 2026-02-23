export function formatRelativeTime(
  dateString: string,
  now: Date = new Date(),
  locale: string = 'en-US',
): string {
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()

  if (!Number.isFinite(diffMs)) return ''

  const absMs = Math.abs(diffMs)
  const diffMins = Math.floor(absMs / 60000)
  const diffHours = Math.floor(absMs / 3600000)
  const diffDays = Math.floor(absMs / 86400000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'short' })

  if (diffMs < 0) {
    if (diffMins < 60) return formatter.format(diffMins, 'minute')
    if (diffHours < 24) return formatter.format(diffHours, 'hour')
    return formatter.format(diffDays, 'day')
  }

  if (diffMins < 60) return formatter.format(-diffMins, 'minute')
  if (diffHours < 24) return formatter.format(-diffHours, 'hour')
  return formatter.format(-diffDays, 'day')
}
