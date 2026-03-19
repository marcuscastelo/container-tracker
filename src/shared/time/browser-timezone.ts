export function getBrowserTimezone(fallback: string = 'UTC'): string {
  const resolvedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return typeof resolvedTimezone === 'string' && resolvedTimezone.length > 0
    ? resolvedTimezone
    : fallback
}
