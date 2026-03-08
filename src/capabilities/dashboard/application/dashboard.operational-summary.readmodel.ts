import type { ProcessAggregatedStatus } from '~/modules/process/application/operational-projection/operationalSemantics'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/application/projection/tracking.active-alert.readmodel'
import {
  type TrackingOperationalAlertCategory,
  toTrackingOperationalAlertCategory,
} from '~/modules/tracking/application/projection/tracking.operational-alert-category.readmodel'

type DashboardDominantSeverity = 'danger' | 'warning' | 'info' | 'success' | 'none'

type DashboardGlobalAlertsBySeverityReadModel = {
  readonly danger: number
  readonly warning: number
  readonly info: number
  readonly success: number
}

type DashboardGlobalAlertsByCategoryReadModel = {
  readonly eta: number
  readonly movement: number
  readonly customs: number
  readonly status: number
  readonly data: number
}

type DashboardGlobalAlertsSummaryReadModel = {
  readonly totalActiveAlerts: number
  readonly bySeverity: DashboardGlobalAlertsBySeverityReadModel
  readonly byCategory: DashboardGlobalAlertsByCategoryReadModel
}

type DashboardOperationalAlertProcessReadModel = {
  readonly processId: string
  readonly reference: string | null
  readonly origin: string | null
  readonly destination: string | null
}

type DashboardOperationalAlertContainerReadModel = {
  readonly containerId: string
  readonly containerNumber: string
}

type DashboardOperationalAlertReadModel = {
  readonly process: DashboardOperationalAlertProcessReadModel
  readonly container: DashboardOperationalAlertContainerReadModel | null
  readonly category: TrackingOperationalAlertCategory
  readonly severity: TrackingActiveAlertReadModel['severity']
  readonly type: TrackingActiveAlertReadModel['category']
  readonly description: TrackingActiveAlertReadModel['type']
  readonly generated_at: string
  readonly retroactive: boolean
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

type ProcessOperationalSummaryProjection = {
  readonly process_status: ProcessAggregatedStatus
  readonly eta: string | null
}

type ProcessWithOperationalSummaryProjection = {
  readonly pwc: ProcessWithContainersProjection
  readonly summary: ProcessOperationalSummaryProjection
}

type DashboardProcessUseCases = {
  listProcessesWithOperationalSummary(): Promise<{
    readonly processes: readonly ProcessWithOperationalSummaryProjection[]
  }>
}

type DashboardTrackingUseCases = {
  listActiveAlertReadModel(): Promise<{
    readonly alerts: readonly TrackingActiveAlertReadModel[]
  }>
}

export type DashboardOperationalSummaryReadModelDeps = {
  readonly processUseCases: DashboardProcessUseCases
  readonly trackingUseCases: DashboardTrackingUseCases
}

type DashboardOperationalProcessReadModel = {
  readonly processId: string
  readonly reference: string | null
  readonly origin: string | null
  readonly destination: string | null
  readonly status: ProcessAggregatedStatus
  readonly eta: string | null
  readonly dominantSeverity: DashboardDominantSeverity
  readonly activeAlertsCount: number
  readonly activeAlerts: readonly TrackingActiveAlertReadModel[]
}

export type DashboardOperationalSummaryReadModel = {
  readonly processes: readonly DashboardOperationalProcessReadModel[]
  readonly globalAlerts: DashboardGlobalAlertsSummaryReadModel
  readonly activeAlertsPanel: readonly DashboardOperationalAlertReadModel[]
}

const DASHBOARD_SEVERITY_ORDER: Readonly<Record<DashboardDominantSeverity, number>> = {
  none: 0,
  success: 1,
  info: 2,
  warning: 3,
  danger: 4,
}

function normalizeDashboardSeverity(severity: string): DashboardDominantSeverity {
  if (severity === 'danger') return 'danger'
  if (severity === 'warning') return 'warning'
  if (severity === 'info') return 'info'
  if (severity === 'success') return 'success'
  return 'none'
}

function resolveDashboardDominantSeverity(
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

type DashboardProcessContext = {
  readonly process: DashboardProcessRecord
  readonly containersById: ReadonlyMap<string, DashboardContainerRecord>
}

function indexDashboardProcessContextById(
  processes: readonly ProcessWithOperationalSummaryProjection[],
): ReadonlyMap<string, DashboardProcessContext> {
  const contextByProcessId = new Map<string, DashboardProcessContext>()

  for (const processWithSummary of processes) {
    const processId = String(processWithSummary.pwc.process.id)
    const containersById = new Map<string, DashboardContainerRecord>()

    for (const container of processWithSummary.pwc.containers) {
      containersById.set(String(container.id), container)
    }

    contextByProcessId.set(processId, {
      process: processWithSummary.pwc.process,
      containersById,
    })
  }

  return contextByProcessId
}

function toDashboardAlertProcessReadModel(
  alertProcessId: string,
  context: DashboardProcessContext | undefined,
): DashboardOperationalAlertProcessReadModel {
  if (!context) {
    return {
      processId: alertProcessId,
      reference: null,
      origin: null,
      destination: null,
    }
  }

  return {
    processId: alertProcessId,
    reference: context.process.reference,
    origin: context.process.origin,
    destination: context.process.destination,
  }
}

function toDashboardAlertContainerReadModel(
  alertContainerId: string,
  context: DashboardProcessContext | undefined,
): DashboardOperationalAlertContainerReadModel | null {
  if (!context) {
    return null
  }

  const container = context.containersById.get(alertContainerId)
  if (!container) {
    return null
  }

  return {
    containerId: alertContainerId,
    containerNumber: container.containerNumber,
  }
}

function buildDashboardActiveAlertsPanel(
  alerts: readonly TrackingActiveAlertReadModel[],
  contextByProcessId: ReadonlyMap<string, DashboardProcessContext>,
): readonly DashboardOperationalAlertReadModel[] {
  return [...alerts]
    .sort((left, right) => {
      const rightTimestamp = Date.parse(right.generated_at)
      const leftTimestamp = Date.parse(left.generated_at)
      if (!Number.isNaN(rightTimestamp) && !Number.isNaN(leftTimestamp)) {
        const byTimestamp = rightTimestamp - leftTimestamp
        if (byTimestamp !== 0) {
          return byTimestamp
        }
      }

      if (left.generated_at !== right.generated_at) {
        return left.generated_at < right.generated_at ? 1 : -1
      }

      const byProcessId = left.process_id.localeCompare(right.process_id)
      if (byProcessId !== 0) {
        return byProcessId
      }

      const byContainerId = left.container_id.localeCompare(right.container_id)
      if (byContainerId !== 0) {
        return byContainerId
      }

      return left.alert_id.localeCompare(right.alert_id)
    })
    .map((alert) => {
      const context = contextByProcessId.get(alert.process_id)

      return {
        process: toDashboardAlertProcessReadModel(alert.process_id, context),
        container: toDashboardAlertContainerReadModel(alert.container_id, context),
        category: toTrackingOperationalAlertCategory(alert.type),
        severity: alert.severity,
        type: alert.category,
        description: alert.type,
        generated_at: alert.generated_at,
        retroactive: alert.retroactive,
      }
    })
}

function sortDashboardProcessesByDominantSeverity(
  processes: readonly DashboardOperationalProcessReadModel[],
): readonly DashboardOperationalProcessReadModel[] {
  function normalizeReference(reference: string | null): string {
    if (reference === null) {
      return '~'
    }

    return reference.trim().toUpperCase()
  }

  return processes
    .map((process, index) => ({ process, index }))
    .sort((left, right) => {
      const rightPriority = DASHBOARD_SEVERITY_ORDER[right.process.dominantSeverity]
      const leftPriority = DASHBOARD_SEVERITY_ORDER[left.process.dominantSeverity]
      if (rightPriority !== leftPriority) {
        return rightPriority - leftPriority
      }

      const leftReference = normalizeReference(left.process.reference)
      const rightReference = normalizeReference(right.process.reference)
      if (leftReference !== rightReference) {
        return leftReference < rightReference ? -1 : 1
      }

      const byProcessId = left.process.processId.localeCompare(right.process.processId)
      if (byProcessId !== 0) {
        return byProcessId
      }

      return left.index - right.index
    })
    .map(({ process }) => process)
}

export function createDashboardOperationalSummaryReadModelUseCase(
  deps: DashboardOperationalSummaryReadModelDeps,
) {
  return async function execute(): Promise<DashboardOperationalSummaryReadModel> {
    const { processes } = await deps.processUseCases.listProcessesWithOperationalSummary()
    const activeAlertsResult = await deps.trackingUseCases.listActiveAlertReadModel()

    const activeAlerts = activeAlertsResult.alerts
    // ensure we only consider alerts that are currently active
    const activeOnly = activeAlerts.filter((a) => a.is_active === true)
    const globalAlerts = summarizeGlobalActiveAlerts(activeOnly)
    const processContextById = indexDashboardProcessContextById(processes)
    const activeAlertsPanel = buildDashboardActiveAlertsPanel(activeOnly, processContextById)
    const alertsByProcessId = groupAlertsByProcessId(activeOnly)
    const dashboardProcesses: readonly DashboardOperationalProcessReadModel[] =
      sortDashboardProcessesByDominantSeverity(
        processes.map((entry) => {
          const processId = String(entry.pwc.process.id)
          const activeAlerts = alertsByProcessId.get(processId) ?? []

          return {
            processId,
            reference: entry.pwc.process.reference,
            origin: entry.pwc.process.origin,
            destination: entry.pwc.process.destination,
            status: entry.summary.process_status,
            eta: entry.summary.eta,
            dominantSeverity: resolveDashboardDominantSeverity(activeAlerts),
            activeAlertsCount: activeAlerts.length,
            activeAlerts,
          }
        }),
      )

    return {
      processes: dashboardProcesses,
      globalAlerts,
      activeAlertsPanel,
    }
  }
}
