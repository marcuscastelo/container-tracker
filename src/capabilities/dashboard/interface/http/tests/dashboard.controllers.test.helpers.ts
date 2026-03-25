import { vi } from 'vitest'
import type { DashboardKpisReadModel } from '~/capabilities/dashboard/application/dashboard.kpis.readmodel'
import type { NavbarAlertsSummaryReadModel } from '~/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel'
import type { DashboardOperationalSummaryReadModel } from '~/capabilities/dashboard/application/dashboard.operational-summary.readmodel'
import type {
  DashboardMonthWindowSize,
  DashboardProcessesCreatedByMonthReadModel,
} from '~/capabilities/dashboard/application/dashboard.processes-created-by-month.readmodel'
import { createDashboardControllers } from '~/capabilities/dashboard/interface/http/dashboard.controllers'

type DashboardControllersUseCases = {
  readonly getOperationalSummaryReadModel: () => Promise<DashboardOperationalSummaryReadModel>
  readonly getNavbarAlertsSummaryReadModel: () => Promise<NavbarAlertsSummaryReadModel>
  readonly getDashboardKpisReadModel: () => Promise<DashboardKpisReadModel>
  readonly getProcessesCreatedByMonthReadModel: (params?: {
    readonly windowSize?: DashboardMonthWindowSize
  }) => Promise<DashboardProcessesCreatedByMonthReadModel>
}

type DashboardControllersUseCaseOverrides = Partial<DashboardControllersUseCases>

function makeEmptyOperationalSummary(): DashboardOperationalSummaryReadModel {
  return {
    globalAlerts: {
      totalActiveAlerts: 0,
      bySeverity: {
        danger: 0,
        warning: 0,
        info: 0,
        success: 0,
      },
      byCategory: {
        eta: 0,
        movement: 0,
        customs: 0,
        status: 0,
        data: 0,
      },
    },
    processes: [],
    activeAlertsPanel: [],
  }
}

function makeEmptyKpis(): DashboardKpisReadModel {
  return {
    activeProcesses: 0,
    trackedContainers: 0,
    processesWithAlerts: 0,
    lastSyncAt: null,
  }
}

function makeEmptyMonthlyReadModel(): DashboardProcessesCreatedByMonthReadModel {
  return {
    months: [],
  }
}

const EMPTY_NAVBAR_ALERTS_SUMMARY: NavbarAlertsSummaryReadModel = {
  totalActiveAlerts: 0,
  processes: [],
}

export function createDashboardControllersHarness(
  overrides: DashboardControllersUseCaseOverrides = {},
) {
  const dashboardUseCases: DashboardControllersUseCases = {
    getOperationalSummaryReadModel:
      overrides.getOperationalSummaryReadModel ?? vi.fn(async () => makeEmptyOperationalSummary()),
    getNavbarAlertsSummaryReadModel:
      overrides.getNavbarAlertsSummaryReadModel ?? vi.fn(async () => EMPTY_NAVBAR_ALERTS_SUMMARY),
    getDashboardKpisReadModel:
      overrides.getDashboardKpisReadModel ?? vi.fn(async () => makeEmptyKpis()),
    getProcessesCreatedByMonthReadModel:
      overrides.getProcessesCreatedByMonthReadModel ??
      vi.fn(async () => makeEmptyMonthlyReadModel()),
  }

  const controllers = createDashboardControllers({
    dashboardUseCases,
  })

  return {
    controllers,
    dashboardUseCases,
  }
}
