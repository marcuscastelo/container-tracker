import type { DashboardProcessUseCases } from '~/capabilities/dashboard/application/dashboard.processes.projection'
import type { OperationalIncidentReadModel } from '~/modules/tracking/application/projection/tracking.shipment-alert-incidents.readmodel'
import type { FindContainersHotReadProjectionResult } from '~/modules/tracking/application/usecases/find-containers-hot-read-projection.usecase'
import { systemClock } from '~/shared/time/clock'

type NavbarIncidentItemReadModel = {
  readonly incidentKey: string
  readonly type: OperationalIncidentReadModel['type']
  readonly category: OperationalIncidentReadModel['category']
  readonly severity: OperationalIncidentReadModel['severity']
  readonly fact: OperationalIncidentReadModel['fact']
  readonly action: OperationalIncidentReadModel['action']
  readonly affectedContainerCount: number
  readonly triggeredAt: string
  readonly containers: readonly {
    readonly containerId: string
    readonly containerNumber: string
    readonly lifecycleState: 'ACTIVE' | 'ACKED' | 'AUTO_RESOLVED'
  }[]
}

export type NavbarProcessAlertGroupReadModel = {
  readonly processId: string
  readonly processReference: string | null
  readonly carrier: string | null
  readonly routeSummary: string
  readonly activeIncidentCount: number
  readonly affectedContainerCount: number
  readonly dominantSeverity: 'danger' | 'warning' | 'info' | 'success' | 'none'
  readonly latestIncidentAt: string | null
  readonly incidents: readonly NavbarIncidentItemReadModel[]
}

export type NavbarAlertsSummaryReadModel = {
  readonly totalActiveIncidents: number
  readonly processes: readonly NavbarProcessAlertGroupReadModel[]
}

type DashboardNavbarTrackingUseCases = {
  findContainersHotReadProjection(command: {
    readonly containers: readonly {
      readonly containerId: string
      readonly containerNumber: string
    }[]
    readonly now: ReturnType<typeof systemClock.now>
  }): Promise<FindContainersHotReadProjectionResult>
}

export type DashboardNavbarAlertsReadModelDeps = {
  readonly processUseCases: DashboardProcessUseCases
  readonly trackingUseCases: DashboardNavbarTrackingUseCases
}

function toRouteSummary(
  origin: string | null | undefined,
  destination: string | null | undefined,
): string {
  return `${origin ?? '—'} → ${destination ?? '—'}`
}

function toDominantSeverity(
  incidents: readonly OperationalIncidentReadModel[],
): NavbarProcessAlertGroupReadModel['dominantSeverity'] {
  if (incidents.some((incident) => incident.severity === 'danger')) return 'danger'
  if (incidents.some((incident) => incident.severity === 'warning')) return 'warning'
  if (incidents.some((incident) => incident.severity === 'info')) return 'info'
  return 'none'
}

function compareIncidentItems(
  left: OperationalIncidentReadModel,
  right: OperationalIncidentReadModel,
): number {
  const severityRank = { info: 0, warning: 1, danger: 2 } as const
  const severityCompare = severityRank[right.severity] - severityRank[left.severity]
  if (severityCompare !== 0) return severityCompare

  const triggeredAtCompare = right.triggeredAt.localeCompare(left.triggeredAt)
  if (triggeredAtCompare !== 0) return triggeredAtCompare

  return left.incidentKey.localeCompare(right.incidentKey)
}

export function createDashboardNavbarAlertsReadModelUseCase(
  deps: DashboardNavbarAlertsReadModelDeps,
) {
  return async function execute(): Promise<NavbarAlertsSummaryReadModel> {
    const { processes } = await deps.processUseCases.listProcessesWithOperationalSummary()
    const containers = processes.flatMap((process) =>
      process.pwc.containers.map((container) => ({
        containerId: container.id,
        containerNumber: container.containerNumber,
      })),
    )

    if (containers.length === 0) {
      return {
        totalActiveIncidents: 0,
        processes: [],
      }
    }

    const hotRead = await deps.trackingUseCases.findContainersHotReadProjection({
      containers,
      now: systemClock.now(),
    })
    const processIdByContainerId = new Map<string, string>()
    for (const process of processes) {
      for (const container of process.pwc.containers) {
        processIdByContainerId.set(container.id, process.pwc.process.id)
      }
    }

    const incidentsByProcessId = new Map<string, OperationalIncidentReadModel[]>()
    for (const incident of hotRead.activeOperationalIncidents.active) {
      const processId = incident.triggerRefs
        .map((triggerRef) => processIdByContainerId.get(triggerRef.containerId) ?? null)
        .find((candidate) => candidate !== null)
      if (processId === undefined || processId === null) continue

      const existing = incidentsByProcessId.get(processId)
      if (existing === undefined) {
        incidentsByProcessId.set(processId, [incident])
        continue
      }

      existing.push(incident)
    }

    const processGroups: NavbarProcessAlertGroupReadModel[] = []

    for (const process of processes) {
      const incidents = [...(incidentsByProcessId.get(process.pwc.process.id) ?? [])].sort(
        compareIncidentItems,
      )
      if (incidents.length === 0) continue

      const affectedContainerCount = new Set(
        incidents.flatMap((incident) =>
          incident.scope.containers.map((container) => container.containerId),
        ),
      ).size

      processGroups.push({
        processId: process.pwc.process.id,
        processReference: process.pwc.process.reference ?? null,
        carrier: process.pwc.process.carrier ?? null,
        routeSummary: toRouteSummary(process.pwc.process.origin, process.pwc.process.destination),
        activeIncidentCount: incidents.length,
        affectedContainerCount,
        dominantSeverity: toDominantSeverity(incidents),
        latestIncidentAt: incidents[0]?.triggeredAt ?? null,
        incidents: incidents.map((incident) => ({
          incidentKey: incident.incidentKey,
          type: incident.type,
          category: incident.category,
          severity: incident.severity,
          fact: incident.fact,
          action: incident.action,
          affectedContainerCount: incident.scope.affectedContainerCount,
          triggeredAt: incident.triggeredAt,
          containers: incident.scope.containers.map((container) => ({
            containerId: container.containerId,
            containerNumber: container.containerNumber,
            lifecycleState: container.lifecycleState,
          })),
        })),
      })
    }

    processGroups.sort((left, right) => {
      const severityRank = { none: 0, success: 1, info: 2, warning: 3, danger: 4 } as const
      const severityCompare =
        severityRank[right.dominantSeverity] - severityRank[left.dominantSeverity]
      if (severityCompare !== 0) return severityCompare
      const countCompare = right.activeIncidentCount - left.activeIncidentCount
      if (countCompare !== 0) return countCompare
      return left.processId.localeCompare(right.processId)
    })

    return {
      totalActiveIncidents: hotRead.activeOperationalIncidents.summary.activeIncidentCount,
      processes: processGroups,
    }
  }
}
