type DashboardRefreshCommand<TSyncResult> = {
  readonly syncAllProcesses: () => TSyncResult | Promise<TSyncResult>
  readonly refetchProcesses: () => unknown
  readonly refetchGlobalAlerts: () => unknown
  readonly refetchDashboardKpis?: () => unknown
  readonly refetchDashboardProcessesCreatedByMonth?: () => unknown
}

function toFirstRejectedReason(results: readonly PromiseSettledResult<unknown>[]): unknown | null {
  for (const result of results) {
    if (result.status === 'rejected') {
      return result.reason
    }
  }
  return null
}

export async function refreshDashboardData<TSyncResult>(
  command: DashboardRefreshCommand<TSyncResult>,
): Promise<TSyncResult> {
  const syncResult = await Promise.resolve(command.syncAllProcesses())

  const refetchTasks: Promise<unknown>[] = [
    Promise.resolve(command.refetchProcesses()),
    Promise.resolve(command.refetchGlobalAlerts()),
  ]

  if (command.refetchDashboardKpis) {
    refetchTasks.push(Promise.resolve(command.refetchDashboardKpis()))
  }

  if (command.refetchDashboardProcessesCreatedByMonth) {
    refetchTasks.push(Promise.resolve(command.refetchDashboardProcessesCreatedByMonth()))
  }

  const results = await Promise.allSettled(refetchTasks)

  const hasFailure = results.some((result) => result.status === 'rejected')
  if (!hasFailure) {
    return syncResult
  }

  const firstRejectedReason = toFirstRejectedReason(results)
  if (firstRejectedReason instanceof Error) {
    throw firstRejectedReason
  }

  throw new Error('Dashboard refresh failed')
}
