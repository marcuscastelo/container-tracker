import type { DashboardNavbarAlertsReadModelDeps } from '~/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel'
import type { DashboardOperationalSummaryReadModelDeps } from '~/capabilities/dashboard/application/dashboard.operational-summary.readmodel'
import { createDashboardUseCases } from '~/capabilities/dashboard/application/dashboard.usecases'
import {
  createDashboardControllers,
  type DashboardControllers,
} from '~/capabilities/dashboard/interface/http/dashboard.controllers'

type DashboardControllersBootstrapOverrides = {
  readonly dashboardControllers?: DashboardControllers
}

export type DashboardControllersBootstrapDeps = Pick<
  DashboardOperationalSummaryReadModelDeps & DashboardNavbarAlertsReadModelDeps,
  'processUseCases' | 'trackingUseCases'
>

export function bootstrapDashboardControllers(
  deps: DashboardControllersBootstrapDeps,
  overrides: DashboardControllersBootstrapOverrides = {},
): DashboardControllers {
  if (overrides.dashboardControllers) {
    return overrides.dashboardControllers
  }

  const dashboardUseCases = createDashboardUseCases({
    processUseCases: deps.processUseCases,
    trackingUseCases: deps.trackingUseCases,
  })

  return createDashboardControllers({
    dashboardUseCases,
  })
}
