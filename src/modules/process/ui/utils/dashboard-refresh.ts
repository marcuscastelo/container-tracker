type DashboardRefreshCommand = {
  readonly refetchProcesses: () => unknown
  readonly refetchGlobalAlerts: () => unknown
}

function toFirstRejectedReason(results: readonly PromiseSettledResult<unknown>[]): unknown | null {
  for (const result of results) {
    if (result.status === 'rejected') {
      return result.reason
    }
  }
  return null
}

export async function refreshDashboardData(command: DashboardRefreshCommand): Promise<void> {
  const results = await Promise.allSettled([
    Promise.resolve(command.refetchProcesses()),
    Promise.resolve(command.refetchGlobalAlerts()),
  ])

  const hasFailure = results.some((result) => result.status === 'rejected')
  if (!hasFailure) {
    return
  }

  const firstRejectedReason = toFirstRejectedReason(results)
  if (firstRejectedReason instanceof Error) {
    throw firstRejectedReason
  }

  throw new Error('Dashboard refresh failed')
}
