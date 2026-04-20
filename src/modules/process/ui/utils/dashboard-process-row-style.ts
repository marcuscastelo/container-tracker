export type DashboardProcessRowSeverity = 'danger' | 'warning' | 'info' | 'success' | 'none'

function getSeverityBorderClass(severity: DashboardProcessRowSeverity): string {
  if (severity === 'danger') return '[box-shadow:inset_4px_0_0_0_var(--color-tone-danger-strong)]'
  if (severity === 'warning') return '[box-shadow:inset_4px_0_0_0_var(--color-tone-warning-strong)]'
  if (severity === 'info') return '[box-shadow:inset_4px_0_0_0_var(--color-tone-info-strong)]'
  return ''
}

export function toDashboardProcessRowClass(command: {
  readonly severity: DashboardProcessRowSeverity
  readonly isHighlighted: boolean
}): string {
  const stateClass = command.isHighlighted
    ? 'bg-primary/5 outline outline-2 -outline-offset-2 outline-primary/25 hover:bg-primary/10'
    : 'bg-surface hover:bg-surface-muted'
  const severityClass = getSeverityBorderClass(command.severity)

  return `grid min-h-(--dashboard-table-row-height) cursor-pointer items-center border-b border-border/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 last:border-b-0 ${stateClass} ${severityClass}`.trim()
}
