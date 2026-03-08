import { bootstrapDashboardControllers } from '~/capabilities/dashboard/interface/http/dashboard.controllers.bootstrap'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'

const { trackingUseCases } = bootstrapTrackingModule()

export const dashboardControllers = bootstrapDashboardControllers({
  processUseCases,
  trackingUseCases,
})
