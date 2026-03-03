import { deriveProcessStatusFromContainers } from '~/modules/process/application/operational-projection/deriveProcessStatus'
import {
  type OperationalStatus,
  toOperationalStatus,
} from '~/modules/process/application/operational-projection/operationalSemantics'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/application/projection/tracking.active-alert.readmodel'
import {
  type TrackingOperationalAlertCategory,
  toTrackingOperationalAlertCategory,
} from '~/modules/tracking/application/projection/tracking.operational-alert-category.readmodel'
import type { TrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'

export type DashboardDominantSeverity = 'danger' | 'warning' | 'info' | 'success' | 'none'
export type DashboardGlobalAlertSeverity = Exclude<DashboardDominantSeverity, 'none'>

export type DashboardGlobalAlertsBySeverityReadModel = {
  readonly danger: number
  readonly warning: number
  readonly info: number
  readonly success: number
}

export type DashboardGlobalAlertsByCategoryReadModel = {
  readonly eta: number
  readonly movement: number
  readonly customs: number
  readonly status: number
  readonly data: number
}

export type DashboardGlobalAlertsSummaryReadModel = {
  readonly totalActiveAlerts: number
  readonly bySeverity: DashboardGlobalAlertsBySeverityReadModel
  readonly byCategory: DashboardGlobalAlertsByCategoryReadModel
}

type DashboardProcessRecord = {
  readonly id: string
  readonly reference: string | null
  readonly origin: string | null
  readonly destination: string | null
}

type DashboardContainerRecord = {
  readonly id: string
  readonly containerNumber: string
}

type ProcessWithContainersProjection = {
  readonly process: DashboardProcessRecord
  readonly containers: readonly DashboardContainerRecord[]
}

type DashboardProcessUseCases = {
  listProcessesWithContainers(): Promise<{
    readonly processes: readonly ProcessWithContainersProjection[]
  }>
}

type DashboardTrackingUseCases = {
  getContainersSummary(
    containers: readonly {
      readonly containerId: string
      readonly containerNumber: string
      readonly podLocationCode?: string | null
    }[],
    now?: Date,
  ): Promise<ReadonlyMap<string, TrackingOperationalSummary>>
  listActiveAlertReadModel(): Promise<{
    readonly alerts: readonly TrackingActiveAlertReadModel[]
  }>
}

export type DashboardOperationalSummaryReadModelDeps = {
  readonly processUseCases: DashboardProcessUseCases
  readonly trackingUseCases: DashboardTrackingUseCases
  readonly nowFactory?: () => Date
}

export type DashboardOperationalProcessReadModel = {
  readonly processId: string
  readonly reference: string | null
  readonly origin: string | null
  readonly destination: string | null
  readonly status: OperationalStatus
  readonly eta: string | null
  readonly dominantSeverity: DashboardDominantSeverity
  readonly activeAlertsCount: number
  readonly activeAlerts: readonly TrackingActiveAlertReadModel[]
}

export type DashboardOperationalSummaryReadModel = {
  readonly processes: readonly DashboardOperationalProcessReadModel[]
  readonly globalAlerts: DashboardGlobalAlertsSummaryReadModel
}

const DASHBOARD_SEVERITY_ORDER: Readonly<Record<DashboardDominantSeverity, number>> = {
  none: 0,
  success: 1,
  info: 2,
  warning: 3,
  danger: 4,
}

const FALLBACK_TRACKING_SUMMARY: TrackingOperationalSummary = {
  status: 'UNKNOWN',
  eta: null,
  transshipment: {
    hasTransshipment: false,
    count: 0,
    ports: [],
  },
  dataIssue: true,
}

function normalizeDashboardSeverity(severity: string): DashboardDominantSeverity {
  if (severity === 'danger') return 'danger'
  if (severity === 'warning') return 'warning'
  if (severity === 'info') return 'info'
  if (severity === 'success') return 'success'
  return 'none'
}

export function resolveDashboardDominantSeverity(
  alerts: readonly { readonly severity: string }[],
): DashboardDominantSeverity {
  let dominantSeverity: DashboardDominantSeverity = 'none'

  for (const alert of alerts) {
    const normalizedSeverity = normalizeDashboardSeverity(alert.severity)
    if (DASHBOARD_SEVERITY_ORDER[normalizedSeverity] > DASHBOARD_SEVERITY_ORDER[dominantSeverity]) {
      dominantSeverity = normalizedSeverity
    }
  }

  return dominantSeverity
}

function countBySeverity(
  alerts: readonly TrackingActiveAlertReadModel[],
): DashboardGlobalAlertsBySeverityReadModel {
  let danger = 0
  let warning = 0
  let info = 0
  let success = 0

  for (const alert of alerts) {
    const severity = normalizeDashboardSeverity(alert.severity)
    if (severity === 'danger') {
      danger += 1
      continue
    }
    if (severity === 'warning') {
      warning += 1
      continue
    }
    if (severity === 'info') {
      info += 1
      continue
    }
    if (severity === 'success') {
      success += 1
    }
  }

  return { danger, warning, info, success }
}

function countByOperationalCategory(
  alerts: readonly TrackingActiveAlertReadModel[],
): DashboardGlobalAlertsByCategoryReadModel {
  let eta = 0
  let movement = 0
  let customs = 0
  let status = 0
  let data = 0

  for (const alert of alerts) {
    const category: TrackingOperationalAlertCategory = toTrackingOperationalAlertCategory(
      alert.type,
    )
    if (category === 'eta') {
      eta += 1
      continue
    }
    if (category === 'movement') {
      movement += 1
      continue
    }
    if (category === 'customs') {
      customs += 1
      continue
    }
    if (category === 'status') {
      status += 1
      continue
    }
    data += 1
  }

  return { eta, movement, customs, status, data }
}

function summarizeGlobalActiveAlerts(
  alerts: readonly TrackingActiveAlertReadModel[],
): DashboardGlobalAlertsSummaryReadModel {
  return {
    totalActiveAlerts: alerts.length,
    bySeverity: countBySeverity(alerts),
    byCategory: countByOperationalCategory(alerts),
  }
}

function deriveDashboardStatus(
  containerSummaries: readonly TrackingOperationalSummary[],
): OperationalStatus {
  const statuses = containerSummaries.map((summary) => toOperationalStatus(summary.status))
  return deriveProcessStatusFromContainers(statuses)
}

function deriveDashboardEta(
  containerSummaries: readonly TrackingOperationalSummary[],
): string | null {
  let eta: string | null = null

  for (const summary of containerSummaries) {
    const nextEta = summary.eta?.eventTimeIso ?? null
    if (nextEta !== null && (eta === null || nextEta < eta)) {
      eta = nextEta
    }
  }

  return eta
}

function groupAlertsByProcessId(
  alerts: readonly TrackingActiveAlertReadModel[],
): ReadonlyMap<string, readonly TrackingActiveAlertReadModel[]> {
  const groupedAlerts = new Map<string, TrackingActiveAlertReadModel[]>()

  for (const alert of alerts) {
    const alertsForProcess = groupedAlerts.get(alert.process_id)
    if (alertsForProcess) {
      alertsForProcess.push(alert)
      continue
    }

    groupedAlerts.set(alert.process_id, [alert])
  }

  return groupedAlerts
}

function toTrackingSummaryOrFallback(
  summariesByContainerId: ReadonlyMap<string, TrackingOperationalSummary>,
  containerId: string,
): TrackingOperationalSummary {
  return summariesByContainerId.get(containerId) ?? FALLBACK_TRACKING_SUMMARY
}

function sortDashboardProcessesByDominantSeverity(
  processes: readonly DashboardOperationalProcessReadModel[],
): readonly DashboardOperationalProcessReadModel[] {
  return processes
    .map((process, index) => ({ process, index }))
    .sort((left, right) => {
      const rightPriority = DASHBOARD_SEVERITY_ORDER[right.process.dominantSeverity]
      const leftPriority = DASHBOARD_SEVERITY_ORDER[left.process.dominantSeverity]
      if (rightPriority !== leftPriority) {
        return rightPriority - leftPriority
      }

      return left.index - right.index
    })
    .map(({ process }) => process)
}

export function createDashboardOperationalSummaryReadModelUseCase(
  deps: DashboardOperationalSummaryReadModelDeps,
) {
  return async function execute(): Promise<DashboardOperationalSummaryReadModel> {
    const now = deps.nowFactory ? deps.nowFactory() : new Date()

    const { processes } = await deps.processUseCases.listProcessesWithContainers()
    const trackingContainers = processes.flatMap((entry) =>
      entry.containers.map((container) => ({
        containerId: String(container.id),
        containerNumber: String(container.containerNumber),
      })),
    )

    const [summariesByContainerId, activeAlertsResult] = await Promise.all([
      deps.trackingUseCases.getContainersSummary(trackingContainers, now),
      deps.trackingUseCases.listActiveAlertReadModel(),
    ])

    const globalAlerts = summarizeGlobalActiveAlerts(activeAlertsResult.alerts)
    const alertsByProcessId = groupAlertsByProcessId(activeAlertsResult.alerts)
    const dashboardProcesses: readonly DashboardOperationalProcessReadModel[] =
      sortDashboardProcessesByDominantSeverity(
        processes.map((entry) => {
          const processId = String(entry.process.id)
          const activeAlerts = alertsByProcessId.get(processId) ?? []
          const containerSummaries = entry.containers.map((container) =>
            toTrackingSummaryOrFallback(summariesByContainerId, String(container.id)),
          )

          return {
            processId,
            reference: entry.process.reference,
            origin: entry.process.origin,
            destination: entry.process.destination,
            status: deriveDashboardStatus(containerSummaries),
            eta: deriveDashboardEta(containerSummaries),
            dominantSeverity: resolveDashboardDominantSeverity(activeAlerts),
            activeAlertsCount: activeAlerts.length,
            activeAlerts,
          }
        }),
      )

    return {
      processes: dashboardProcesses,
      globalAlerts,
    }
  }
}
