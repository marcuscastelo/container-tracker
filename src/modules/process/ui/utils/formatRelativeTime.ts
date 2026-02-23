export function formatRelativeTime(dateString: string, now: Date = new Date()): string {
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()

  if (!Number.isFinite(diffMs)) return ''

  const absMs = Math.abs(diffMs)
  const diffMins = Math.floor(absMs / 60000)
  const diffHours = Math.floor(absMs / 3600000)
  const diffDays = Math.floor(absMs / 86400000)

  if (diffMs < 0) {
    if (diffMins < 60) return `in ${diffMins}m`
    if (diffHours < 24) return `in ${diffHours}h`
    return `in ${diffDays}d`
  }

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}
