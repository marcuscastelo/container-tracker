import {
  createDashboardKpisReadModelUseCase,
  type DashboardKpisReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.kpis.readmodel'
import {
  createDashboardOperationalSummaryReadModelUseCase,
  type DashboardOperationalSummaryReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.operational-summary.readmodel'
import {
  createDashboardProcessesCreatedByMonthReadModelUseCase,
  type DashboardProcessesCreatedByMonthReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.processes-created-by-month.readmodel'

type DashboardUseCasesDeps = DashboardOperationalSummaryReadModelDeps &
  DashboardKpisReadModelDeps &
  DashboardProcessesCreatedByMonthReadModelDeps

export function createDashboardUseCases(deps: DashboardUseCasesDeps) {
  const getOperationalSummaryReadModel = createDashboardOperationalSummaryReadModelUseCase(deps)
  const getDashboardKpisReadModel = createDashboardKpisReadModelUseCase(deps)
  const getProcessesCreatedByMonthReadModel =
    createDashboardProcessesCreatedByMonthReadModelUseCase(deps)

  return {
    getOperationalSummaryReadModel,
    getDashboardKpisReadModel,
    getProcessesCreatedByMonthReadModel,
  }
}

export type DashboardUseCases = ReturnType<typeof createDashboardUseCases>
