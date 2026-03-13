import { typedFetch } from '~/shared/api/typedFetch'
import {
  type DashboardProcessesCreatedByMonthResponse,
  DashboardProcessesCreatedByMonthResponseSchema,
} from '~/shared/api-schemas/dashboard.schemas'

const DASHBOARD_PROCESSES_CREATED_BY_MONTH_ENDPOINT =
  '/api/dashboard/charts/processes-created-by-month'

export type DashboardChartWindowSize = 6 | 12 | 24

type FetchDashboardProcessesCreatedByMonthCommand = {
  readonly windowSize?: DashboardChartWindowSize
}

function toDashboardProcessesCreatedByMonthUrl(
  command: FetchDashboardProcessesCreatedByMonthCommand = {},
): string {
  const { windowSize } = command
  if (windowSize === undefined) {
    return DASHBOARD_PROCESSES_CREATED_BY_MONTH_ENDPOINT
  }

  return `${DASHBOARD_PROCESSES_CREATED_BY_MONTH_ENDPOINT}?window=${windowSize}`
}

export async function fetchDashboardProcessesCreatedByMonth(
  command: FetchDashboardProcessesCreatedByMonthCommand = {},
): Promise<DashboardProcessesCreatedByMonthResponse> {
  return typedFetch(
    toDashboardProcessesCreatedByMonthUrl(command),
    undefined,
    DashboardProcessesCreatedByMonthResponseSchema,
  )
}
