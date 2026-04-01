type VisibleDashboardProcessRect = {
  readonly bottom: number
  readonly top: number
}

type VisibleDashboardProcessRow = {
  readonly dataset: {
    readonly dashboardProcessId?: string
  }
  readonly getBoundingClientRect: () => VisibleDashboardProcessRect
}

type VisibleDashboardProcessContainer = {
  readonly querySelectorAll: (selector: string) => Iterable<VisibleDashboardProcessRow>
}

export function collectVisibleDashboardProcessIds(
  container: VisibleDashboardProcessContainer | undefined,
  viewportBottom = typeof window !== 'undefined' ? window.innerHeight : Number.POSITIVE_INFINITY,
): readonly string[] {
  if (!container) return []

  const viewportTop = 0
  const rows = container.querySelectorAll('[data-dashboard-process-id]')
  const visibleProcessIds: string[] = []

  for (const row of rows) {
    const processId = row.dataset.dashboardProcessId
    if (!processId) continue

    const rowRect = row.getBoundingClientRect()
    if (rowRect.bottom <= viewportTop) continue
    if (rowRect.top >= viewportBottom) break

    visibleProcessIds.push(processId)
  }

  return visibleProcessIds
}
