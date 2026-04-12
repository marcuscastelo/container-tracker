import type {
  DashboardProcessUseCases,
  DashboardProcessWithOperationalSummaryProjection,
} from '~/capabilities/dashboard/application/dashboard.processes.projection'
import type {
  OperationalIncidentReadModel,
} from '~/modules/tracking/application/projection/tracking.operational-incidents.readmodel'
import type { FindContainersHotReadProjectionResult } from '~/modules/tracking/application/usecases/find-containers-hot-read-projection.usecase'
import type { ProcessAggregatedStatus } from '~/modules/process/features/operational-projection/application/operationalSemantics'
import type { TemporalValueDto } from '~/shared/time/dto'
import { systemClock } from '~/shared/time/clock'

type DashboardDominantSeverity = 'danger' | 'warning' | 'info' | 'success' | 'none'

type DashboardGlobalAlertsBySeverityReadModel = {
  readonly danger: number
  readonly warning: number
  readonly info: number
}

type DashboardGlobalAlertsByCategoryReadModel = {
  readonly eta: number
  readonly movement: number
  readonly customs: number
  readonly data: number
}

type DashboardGlobalAlertsSummaryReadModel = {
  readonly totalActiveIncidents: number
  readonly affectedContainersCount: number
  readonly recognizedIncidentsCount: number
  readonly bySeverity: DashboardGlobalAlertsBySeverityReadModel
  readonly byCategory: DashboardGlobalAlertsByCategoryReadModel
}

type DashboardDominantIncidentReadModel = {
  readonly type: OperationalIncidentReadModel['type']
  readonly severity: OperationalIncidentReadModel['severity']
  readonly fact: OperationalIncidentReadModel['fact']
  readonly triggeredAt: string
}

type DashboardOperationalProcessReadModel = {
  readonly processId: string
  readonly reference: string | null
  readonly origin: string | null
  readonly destination: string | null
  readonly status: ProcessAggregatedStatus
  readonly eta: TemporalValueDto | null
  readonly dominantSeverity: DashboardDominantSeverity
  readonly activeIncidentCount: number
  readonly affectedContainerCount: number
  readonly dominantIncident: DashboardDominantIncidentReadModel | null
}

type DashboardTrackingUseCases = {
  findContainersHotReadProjection(command: {
    readonly containers: readonly {
      readonly containerId: string
      readonly containerNumber: string
    }[]
    readonly now: ReturnType<typeof systemClock.now>
  }): Promise<FindContainersHotReadProjectionResult>
}

export type DashboardOperationalSummaryReadModelDeps = {
  readonly processUseCases: DashboardProcessUseCases
  readonly trackingUseCases: DashboardTrackingUseCases
}

export type DashboardOperationalSummaryReadModel = {
  readonly processes: readonly DashboardOperationalProcessReadModel[]
  readonly globalAlerts: DashboardGlobalAlertsSummaryReadModel
}

function normalizeDashboardSeverity(
  severity: OperationalIncidentReadModel['severity'] | null | undefined,
): DashboardDominantSeverity {
  if (severity === 'danger') return 'danger'
  if (severity === 'warning') return 'warning'
  if (severity === 'info') return 'info'
  return 'none'
}

function groupIncidentsByProcessId(command: {
  readonly incidents: readonly OperationalIncidentReadModel[]
  readonly processes: readonly DashboardProcessWithOperationalSummaryProjection[]
}): ReadonlyMap<string, readonly OperationalIncidentReadModel[]> {
  const processIdByContainerId = new Map<string, string>()
  for (const process of command.processes) {
    for (const container of process.pwc.containers) {
      processIdByContainerId.set(container.id, process.pwc.process.id)
    }
  }

  const grouped = new Map<string, OperationalIncidentReadModel[]>()
  for (const incident of command.incidents) {
    const processId = incident.triggerRefs
      .map((triggerRef) => processIdByContainerId.get(triggerRef.containerId) ?? null)
      .find((candidate) => candidate !== null)

    if (processId === undefined || processId === null) {
      continue
    }

    const existing = grouped.get(processId)
    if (existing === undefined) {
      grouped.set(processId, [incident])
      continue
    }

    existing.push(incident)
  }

  return grouped
}

function countBySeverity(
  incidents: readonly OperationalIncidentReadModel[],
): DashboardGlobalAlertsBySeverityReadModel {
  let danger = 0
  let warning = 0
  let info = 0

  for (const incident of incidents) {
    if (incident.severity === 'danger') {
      danger += 1
      continue
    }
    if (incident.severity === 'warning') {
      warning += 1
      continue
    }
    info += 1
  }

  return { danger, warning, info }
}

function countByCategory(
  incidents: readonly OperationalIncidentReadModel[],
): DashboardGlobalAlertsByCategoryReadModel {
  let eta = 0
  let movement = 0
  let customs = 0
  let data = 0

  for (const incident of incidents) {
    if (incident.category === 'eta') {
      eta += 1
      continue
    }
    if (incident.category === 'movement') {
      movement += 1
      continue
    }
    if (incident.category === 'customs') {
      customs += 1
      continue
    }
    data += 1
  }

  return { eta, movement, customs, data }
}

function summarizeGlobalActiveIncidents(
  incidents: readonly OperationalIncidentReadModel[],
): DashboardGlobalAlertsSummaryReadModel {
  const affectedContainerIds = new Set(
    incidents.flatMap((incident) => incident.scope.containers.map((container) => container.containerId)),
  )

  return {
    totalActiveIncidents: incidents.length,
    affectedContainersCount: affectedContainerIds.size,
    recognizedIncidentsCount: 0,
    bySeverity: countBySeverity(incidents),
    byCategory: countByCategory(incidents),
  }
}

function toDashboardProcessReadModel(
  process: DashboardProcessWithOperationalSummaryProjection,
): DashboardOperationalProcessReadModel {
  const summary = process.summary
  const dominantIncident = summary.operational_incidents?.dominant ?? null

  return {
    processId: process.pwc.process.id,
    reference: process.pwc.process.reference ?? null,
    origin: process.pwc.process.origin ?? null,
    destination: process.pwc.process.destination ?? null,
    status: summary.process_status ?? 'UNKNOWN',
    eta: summary.eta ?? null,
    dominantSeverity: normalizeDashboardSeverity(dominantIncident?.severity ?? null),
    activeIncidentCount: summary.operational_incidents?.summary.active_incidents_count ?? 0,
    affectedContainerCount: summary.operational_incidents?.summary.affected_containers_count ?? 0,
    dominantIncident:
      dominantIncident === null
        ? null
        : {
            type: dominantIncident.type,
            severity: dominantIncident.severity,
            fact: dominantIncident.fact,
            triggeredAt: dominantIncident.triggeredAt,
          },
  }
}

export function createDashboardOperationalSummaryReadModelUseCase(
  deps: DashboardOperationalSummaryReadModelDeps,
) {
  return async function execute(): Promise<DashboardOperationalSummaryReadModel> {
    const { processes } = await deps.processUseCases.listProcessesWithOperationalSummary()
    const allContainers = processes.flatMap((process) =>
      process.pwc.containers.map((container) => ({
        containerId: container.id,
        containerNumber: container.containerNumber,
      })),
    )
    const hotReadProjection =
      allContainers.length === 0
        ? ({
            containers: [],
            activeOperationalIncidents: {
              summary: {
                activeIncidentCount: 0,
                affectedContainerCount: 0,
                recognizedIncidentCount: 0,
              },
              active: [],
              recognized: [],
            },
            activeAlerts: [],
          } satisfies FindContainersHotReadProjectionResult)
        : await deps.trackingUseCases.findContainersHotReadProjection({
            containers: allContainers,
            now: systemClock.now(),
          })

    const groupedIncidents = groupIncidentsByProcessId({
      incidents: hotReadProjection.activeOperationalIncidents.active,
      processes,
    })

    const processReadModels = processes.map((process) => {
      const incidentCount = groupedIncidents.get(process.pwc.process.id)?.length ?? 0
      const base = toDashboardProcessReadModel(process)
      return incidentCount === base.activeIncidentCount
        ? base
        : { ...base, activeIncidentCount: incidentCount }
    })

    return {
      processes: processReadModels,
      globalAlerts: summarizeGlobalActiveIncidents(hotReadProjection.activeOperationalIncidents.active),
    }
  }
}
