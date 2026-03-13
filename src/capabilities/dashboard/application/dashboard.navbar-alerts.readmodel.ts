import {
  indexProcessContextById,
  toContainerSummaryCommand,
  upsertContainerAccumulator,
  upsertProcessAccumulator,
} from '~/capabilities/dashboard/application/dashboard.navbar-alerts.grouping'
import { toAlertItemReadModel } from '~/capabilities/dashboard/application/dashboard.navbar-alerts.message-contract'
import type {
  DashboardNavbarAlertsReadModelDeps,
  MutableProcessAccumulator,
  NavbarAlertsSummaryReadModel,
  NavbarContainerAlertGroupReadModel,
  NavbarProcessAlertGroupReadModel,
} from '~/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel.shared'
import {
  compareNavbarAlertItems,
  compareNavbarContainers,
  compareNavbarProcesses,
  resolveDominantSeverity,
  resolveLatestAlertAt,
} from '~/capabilities/dashboard/application/dashboard.navbar-alerts.sorting'
import type { TrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'

export type {
  DashboardNavbarAlertsReadModelDeps,
  NavbarAlertsSummaryReadModel,
} from '~/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel.shared'

export function createDashboardNavbarAlertsReadModelUseCase(
  deps: DashboardNavbarAlertsReadModelDeps,
) {
  return async function execute(): Promise<NavbarAlertsSummaryReadModel> {
    const [{ processes }, activeAlertsResult] = await Promise.all([
      deps.processUseCases.listProcessesWithOperationalSummary(),
      deps.trackingUseCases.listActiveAlertReadModel(),
    ])

    const activeAlerts = activeAlertsResult.alerts.filter((alert) => alert.is_active === true)
    if (activeAlerts.length === 0) {
      return {
        totalActiveAlerts: 0,
        processes: [],
      }
    }

    const contextByProcessId = indexProcessContextById(processes)
    const containerSummaryCommand = toContainerSummaryCommand(activeAlerts, contextByProcessId)

    const containerOperationalById =
      containerSummaryCommand.length === 0
        ? new Map<string, TrackingOperationalSummary>()
        : await deps.trackingUseCases.getContainersSummary(containerSummaryCommand, new Date())

    const processAccumulatorsById = new Map<string, MutableProcessAccumulator>()

    for (const alert of activeAlerts) {
      const context = contextByProcessId.get(alert.process_id)
      const processAccumulator = upsertProcessAccumulator(processAccumulatorsById, {
        alert,
        context,
      })

      const containerSummary = containerOperationalById.get(alert.container_id)
      const containerAccumulator = upsertContainerAccumulator({
        processAccumulator,
        alert,
        context,
        status: containerSummary?.status ?? null,
        eta: containerSummary?.eta?.eventTimeIso ?? null,
      })

      containerAccumulator.alerts.push(toAlertItemReadModel(alert))
    }

    const processGroups: NavbarProcessAlertGroupReadModel[] = []
    for (const processAccumulator of processAccumulatorsById.values()) {
      const containerGroups: NavbarContainerAlertGroupReadModel[] = []
      for (const containerAccumulator of processAccumulator.containersById.values()) {
        const sortedAlerts = [...containerAccumulator.alerts].sort(compareNavbarAlertItems)
        const dominantSeverity = resolveDominantSeverity(
          sortedAlerts.map((alert) => alert.severity),
        )
        const latestAlertAt = resolveLatestAlertAt(sortedAlerts)

        containerGroups.push({
          containerId: containerAccumulator.containerId,
          containerNumber: containerAccumulator.containerNumber,
          status: containerAccumulator.status,
          eta: containerAccumulator.eta,
          activeAlertsCount: sortedAlerts.length,
          dominantSeverity,
          latestAlertAt,
          alerts: sortedAlerts,
        })
      }

      const sortedContainers = [...containerGroups].sort(compareNavbarContainers)
      const processAlerts = sortedContainers.flatMap((container) => container.alerts)
      const processDominantSeverity = resolveDominantSeverity(
        processAlerts.map((alert) => alert.severity),
      )

      processGroups.push({
        processId: processAccumulator.processId,
        processReference: processAccumulator.processReference,
        carrier: processAccumulator.carrier,
        routeSummary: processAccumulator.routeSummary,
        activeAlertsCount: processAlerts.length,
        dominantSeverity: processDominantSeverity,
        latestAlertAt: resolveLatestAlertAt(processAlerts),
        containers: sortedContainers,
      })
    }

    return {
      totalActiveAlerts: activeAlerts.length,
      processes: processGroups.sort(compareNavbarProcesses),
    }
  }
}
