export function formatRelativeTime(dateString: string, now: Date = new Date()): string {
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()

  if (!Number.isFinite(diffMs)) return ''

  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${Math.max(diffMins, 0)}m ago`
  if (diffHours < 24) return `${Math.max(diffHours, 0)}h ago`
  return `${Math.max(diffDays, 0)}d ago`
}
