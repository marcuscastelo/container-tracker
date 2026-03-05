import { createDashboardUseCases } from '~/capabilities/dashboard/application/dashboard.usecases'
import {
  createDashboardControllers,
  type DashboardControllers,
} from '~/capabilities/dashboard/interface/http/dashboard.controllers'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'

export type DashboardControllersBootstrapOverrides = {
  readonly dashboardControllers?: DashboardControllers
}

function bootstrapDashboardControllers(
  overrides: DashboardControllersBootstrapOverrides = {},
): DashboardControllers {
  if (overrides.dashboardControllers) {
    return overrides.dashboardControllers
  }

  const { trackingUseCases } = bootstrapTrackingModule()
  const dashboardUseCases = createDashboardUseCases({
    processUseCases,
    trackingUseCases,
  })

  return createDashboardControllers({
    dashboardUseCases,
  })
}

export const dashboardControllers = bootstrapDashboardControllers()
