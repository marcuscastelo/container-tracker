import {
  createDashboardOperationalSummaryReadModelUseCase,
  type DashboardOperationalSummaryReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.operational-summary.readmodel'

export function createDashboardUseCases(deps: DashboardOperationalSummaryReadModelDeps) {
  const getOperationalSummaryReadModel = createDashboardOperationalSummaryReadModelUseCase(deps)

  return {
    getOperationalSummaryReadModel,
  }
}

export type DashboardUseCases = ReturnType<typeof createDashboardUseCases>
