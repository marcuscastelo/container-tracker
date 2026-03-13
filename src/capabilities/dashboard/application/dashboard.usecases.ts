import {
  createDashboardKpisReadModelUseCase,
  type DashboardKpisReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.kpis.readmodel'
import {
  createDashboardNavbarAlertsReadModelUseCase,
  type DashboardNavbarAlertsReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel'
import {
  createDashboardOperationalSummaryReadModelUseCase,
  type DashboardOperationalSummaryReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.operational-summary.readmodel'
import {
  createDashboardProcessesCreatedByMonthReadModelUseCase,
  type DashboardProcessesCreatedByMonthReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.processes-created-by-month.readmodel'

type DashboardUseCasesDeps = DashboardOperationalSummaryReadModelDeps &
  DashboardNavbarAlertsReadModelDeps &
  DashboardKpisReadModelDeps &
  DashboardProcessesCreatedByMonthReadModelDeps

export function createDashboardUseCases(deps: DashboardUseCasesDeps) {
  const getOperationalSummaryReadModel = createDashboardOperationalSummaryReadModelUseCase(deps)
  const getNavbarAlertsSummaryReadModel = createDashboardNavbarAlertsReadModelUseCase(deps)
  const getDashboardKpisReadModel = createDashboardKpisReadModelUseCase(deps)
  const getProcessesCreatedByMonthReadModel =
    createDashboardProcessesCreatedByMonthReadModelUseCase(deps)

  return {
    getOperationalSummaryReadModel,
    getNavbarAlertsSummaryReadModel,
    getDashboardKpisReadModel,
    getProcessesCreatedByMonthReadModel,
  }
}

export type DashboardUseCases = ReturnType<typeof createDashboardUseCases>
