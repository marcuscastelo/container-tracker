import type { DashboardChartWindowSize } from '~/modules/process/ui/fetchDashboardProcessesCreatedByMonth'

export const DASHBOARD_CHART_TABLET_MIN_WIDTH = 768
export const DASHBOARD_CHART_DESKTOP_MIN_WIDTH = 1280

export function resolveDashboardChartWindowSize(viewportWidth: number): DashboardChartWindowSize {
  if (viewportWidth >= DASHBOARD_CHART_DESKTOP_MIN_WIDTH) {
    return 24
  }

  if (viewportWidth >= DASHBOARD_CHART_TABLET_MIN_WIDTH) {
    return 12
  }

  return 6
}
