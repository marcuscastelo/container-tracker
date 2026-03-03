import { deriveProcessStatusFromContainers } from '~/modules/process/application/operational-projection/deriveProcessStatus'
import {
  type OperationalStatus,
  toOperationalStatus,
} from '~/modules/process/application/operational-projection/operationalSemantics'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/application/projection/tracking.active-alert.readmodel'
import type { TrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'

export type DashboardDominantSeverity = 'danger' | 'warning' | 'info' | 'success' | 'none'

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

    const alertsByProcessId = groupAlertsByProcessId(activeAlertsResult.alerts)
    const dashboardProcesses: DashboardOperationalProcessReadModel[] = processes.map((entry) => {
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
    })

    return { processes: dashboardProcesses }
  }
}
