import type {
  DashboardContainerRecordProjection,
  DashboardProcessUseCases,
  DashboardProcessWithOperationalSummaryProjection,
} from '~/capabilities/dashboard/application/dashboard.processes.projection'
import type { TrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'

type DashboardNavbarSeverity = 'danger' | 'warning' | 'info' | 'success' | 'none'

type DashboardTrackingUseCases = {
  listActiveAlertReadModel(): Promise<{
    readonly alerts: readonly TrackingActiveAlertReadModel[]
  }>
  getContainersSummary(
    containers: readonly {
      readonly containerId: string
      readonly containerNumber: string
      readonly podLocationCode?: string | null
    }[],
    now?: Date,
  ): Promise<Map<string, TrackingOperationalSummary>>
}

export type DashboardNavbarAlertsReadModelDeps = {
  readonly processUseCases: DashboardProcessUseCases
  readonly trackingUseCases: DashboardTrackingUseCases
}

type NavbarAlertMessageContract =
  | {
      readonly messageKey: 'alerts.transshipmentDetected'
      readonly messageParams: {
        readonly port: string
        readonly fromVessel: string
        readonly toVessel: string
      }
    }
  | {
      readonly messageKey: 'alerts.customsHoldDetected'
      readonly messageParams: {
        readonly location: string
      }
    }
  | {
      readonly messageKey: 'alerts.noMovementDetected'
      readonly messageParams: {
        readonly threshold_days: number
        readonly days_without_movement: number
        readonly days: number
        readonly lastEventDate: string
      }
    }
  | {
      readonly messageKey: 'alerts.etaMissing'
      readonly messageParams: Readonly<Record<never, never>>
    }
  | {
      readonly messageKey: 'alerts.etaPassed'
      readonly messageParams: Readonly<Record<never, never>>
    }
  | {
      readonly messageKey: 'alerts.portChange'
      readonly messageParams: Readonly<Record<never, never>>
    }
  | {
      readonly messageKey: 'alerts.dataInconsistent'
      readonly messageParams: Readonly<Record<never, never>>
    }

type NavbarAlertItemReadModel = {
  readonly alertId: string
  readonly severity: TrackingActiveAlertReadModel['severity']
  readonly category: TrackingActiveAlertReadModel['category']
  readonly occurredAt: string
  readonly retroactive: boolean
} & NavbarAlertMessageContract

type NavbarContainerAlertGroupReadModel = {
  readonly containerId: string
  readonly containerNumber: string
  readonly status: string | null
  readonly eta: string | null
  readonly activeAlertsCount: number
  readonly dominantSeverity: DashboardNavbarSeverity
  readonly latestAlertAt: string | null
  readonly alerts: readonly NavbarAlertItemReadModel[]
}

type NavbarProcessAlertGroupReadModel = {
  readonly processId: string
  readonly processReference: string | null
  readonly carrier: string | null
  readonly routeSummary: string
  readonly activeAlertsCount: number
  readonly dominantSeverity: DashboardNavbarSeverity
  readonly latestAlertAt: string | null
  readonly containers: readonly NavbarContainerAlertGroupReadModel[]
}

export type NavbarAlertsSummaryReadModel = {
  readonly totalActiveAlerts: number
  readonly processes: readonly NavbarProcessAlertGroupReadModel[]
}

type ProcessContext = {
  readonly process: DashboardProcessWithOperationalSummaryProjection['pwc']['process']
  readonly containersById: ReadonlyMap<string, DashboardContainerRecordProjection>
}

type MutableContainerAccumulator = {
  readonly containerId: string
  readonly containerNumber: string
  readonly status: string | null
  readonly eta: string | null
  readonly alerts: NavbarAlertItemReadModel[]
}

type MutableProcessAccumulator = {
  readonly processId: string
  readonly processReference: string | null
  readonly carrier: string | null
  readonly routeSummary: string
  readonly containersById: Map<string, MutableContainerAccumulator>
}

const DASHBOARD_NAVBAR_SEVERITY_ORDER: Readonly<Record<DashboardNavbarSeverity, number>> = {
  none: 0,
  success: 1,
  info: 2,
  warning: 3,
  danger: 4,
}

function toRouteSummary(origin: string | null, destination: string | null): string {
  const normalizedOrigin = origin?.trim() ?? ''
  const normalizedDestination = destination?.trim() ?? ''
  return `${normalizedOrigin.length > 0 ? normalizedOrigin : '—'} → ${normalizedDestination.length > 0 ? normalizedDestination : '—'}`
}

function toTimestampOrNegativeInfinity(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function compareIsoDesc(left: string | null, right: string | null): number {
  const leftTimestamp = toTimestampOrNegativeInfinity(left)
  const rightTimestamp = toTimestampOrNegativeInfinity(right)
  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp
  }

  const safeLeft = left ?? ''
  const safeRight = right ?? ''
  if (safeLeft !== safeRight) {
    return safeLeft < safeRight ? 1 : -1
  }
  return 0
}

function toNavbarSeverity(
  severity: TrackingActiveAlertReadModel['severity'],
): DashboardNavbarSeverity {
  if (severity === 'danger') return 'danger'
  if (severity === 'warning') return 'warning'
  if (severity === 'info') return 'info'
  return 'none'
}

function compareSeverityDesc(
  left: DashboardNavbarSeverity,
  right: DashboardNavbarSeverity,
): number {
  return DASHBOARD_NAVBAR_SEVERITY_ORDER[right] - DASHBOARD_NAVBAR_SEVERITY_ORDER[left]
}

function resolveDominantSeverity(
  severities: readonly TrackingActiveAlertReadModel['severity'][],
): DashboardNavbarSeverity {
  let dominant: DashboardNavbarSeverity = 'none'

  for (const severity of severities) {
    const current = toNavbarSeverity(severity)
    if (compareSeverityDesc(dominant, current) > 0) {
      dominant = current
    }
  }

  return dominant
}

function resolveLatestAlertAt(alerts: readonly NavbarAlertItemReadModel[]): string | null {
  if (alerts.length === 0) return null

  let latest = alerts[0].occurredAt
  for (const alert of alerts) {
    if (compareIsoDesc(latest, alert.occurredAt) > 0) {
      latest = alert.occurredAt
    }
  }
  return latest
}

function isTransshipmentParams(
  params: TrackingActiveAlertReadModel['message_params'],
): params is Extract<
  NavbarAlertMessageContract,
  { messageKey: 'alerts.transshipmentDetected' }
>['messageParams'] {
  return (
    typeof params === 'object' &&
    params !== null &&
    'port' in params &&
    typeof params.port === 'string' &&
    'fromVessel' in params &&
    typeof params.fromVessel === 'string' &&
    'toVessel' in params &&
    typeof params.toVessel === 'string'
  )
}

function isCustomsHoldParams(
  params: TrackingActiveAlertReadModel['message_params'],
): params is Extract<
  NavbarAlertMessageContract,
  { messageKey: 'alerts.customsHoldDetected' }
>['messageParams'] {
  return (
    typeof params === 'object' &&
    params !== null &&
    'location' in params &&
    typeof params.location === 'string'
  )
}

function isNoMovementParams(
  params: TrackingActiveAlertReadModel['message_params'],
): params is Extract<
  NavbarAlertMessageContract,
  { messageKey: 'alerts.noMovementDetected' }
>['messageParams'] {
  return (
    typeof params === 'object' &&
    params !== null &&
    'threshold_days' in params &&
    typeof params.threshold_days === 'number' &&
    'days_without_movement' in params &&
    typeof params.days_without_movement === 'number' &&
    'days' in params &&
    typeof params.days === 'number' &&
    'lastEventDate' in params &&
    typeof params.lastEventDate === 'string'
  )
}

function toAlertItemReadModel(alert: TrackingActiveAlertReadModel): NavbarAlertItemReadModel {
  const baseAlert = {
    alertId: alert.alert_id,
    severity: alert.severity,
    category: alert.category,
    occurredAt: alert.generated_at,
    retroactive: alert.retroactive,
  }

  switch (alert.message_key) {
    case 'alerts.transshipmentDetected':
      if (!isTransshipmentParams(alert.message_params)) {
        return {
          ...baseAlert,
          messageKey: 'alerts.dataInconsistent',
          messageParams: {},
        }
      }
      return {
        ...baseAlert,
        messageKey: alert.message_key,
        messageParams: alert.message_params,
      }
    case 'alerts.customsHoldDetected':
      if (!isCustomsHoldParams(alert.message_params)) {
        return {
          ...baseAlert,
          messageKey: 'alerts.dataInconsistent',
          messageParams: {},
        }
      }
      return {
        ...baseAlert,
        messageKey: alert.message_key,
        messageParams: alert.message_params,
      }
    case 'alerts.noMovementDetected':
      if (!isNoMovementParams(alert.message_params)) {
        return {
          ...baseAlert,
          messageKey: 'alerts.dataInconsistent',
          messageParams: {},
        }
      }
      return {
        ...baseAlert,
        messageKey: alert.message_key,
        messageParams: alert.message_params,
      }
    case 'alerts.etaMissing':
      return {
        ...baseAlert,
        messageKey: 'alerts.etaMissing',
        messageParams: {},
      }
    case 'alerts.etaPassed':
      return {
        ...baseAlert,
        messageKey: 'alerts.etaPassed',
        messageParams: {},
      }
    case 'alerts.portChange':
      return {
        ...baseAlert,
        messageKey: 'alerts.portChange',
        messageParams: {},
      }
    case 'alerts.dataInconsistent':
      return {
        ...baseAlert,
        messageKey: 'alerts.dataInconsistent',
        messageParams: {},
      }
  }
}

function indexProcessContextById(
  processes: readonly DashboardProcessWithOperationalSummaryProjection[],
): ReadonlyMap<string, ProcessContext> {
  const contextByProcessId = new Map<string, ProcessContext>()

  for (const processWithSummary of processes) {
    const processId = processWithSummary.pwc.process.id
    const containersById = new Map<string, DashboardContainerRecordProjection>()
    for (const container of processWithSummary.pwc.containers) {
      containersById.set(container.id, container)
    }

    contextByProcessId.set(processId, {
      process: processWithSummary.pwc.process,
      containersById,
    })
  }

  return contextByProcessId
}

function resolveCarrier(
  process: DashboardProcessWithOperationalSummaryProjection['pwc']['process'] | undefined,
): string | null {
  if (!process || !('carrier' in process)) return null
  const carrier = process.carrier
  if (typeof carrier !== 'string') return null
  const normalizedCarrier = carrier.trim()
  return normalizedCarrier.length > 0 ? normalizedCarrier : null
}

function toContainerSummaryCommand(
  alerts: readonly TrackingActiveAlertReadModel[],
  contextByProcessId: ReadonlyMap<string, ProcessContext>,
): readonly {
  readonly containerId: string
  readonly containerNumber: string
  readonly podLocationCode: string | null
}[] {
  const dedupedByContainerId = new Map<
    string,
    {
      readonly containerId: string
      readonly containerNumber: string
      readonly podLocationCode: string | null
    }
  >()

  for (const alert of alerts) {
    if (dedupedByContainerId.has(alert.container_id)) continue

    const context = contextByProcessId.get(alert.process_id)
    const containerNumber = context?.containersById.get(alert.container_id)?.containerNumber
    if (!containerNumber) continue

    dedupedByContainerId.set(alert.container_id, {
      containerId: alert.container_id,
      containerNumber,
      podLocationCode: null,
    })
  }

  return [...dedupedByContainerId.values()]
}

function compareNavbarAlertItems(
  left: NavbarAlertItemReadModel,
  right: NavbarAlertItemReadModel,
): number {
  const bySeverity = compareSeverityDesc(
    toNavbarSeverity(left.severity),
    toNavbarSeverity(right.severity),
  )
  if (bySeverity !== 0) return bySeverity

  const byOccurredAt = compareIsoDesc(left.occurredAt, right.occurredAt)
  if (byOccurredAt !== 0) return byOccurredAt

  return left.alertId.localeCompare(right.alertId)
}

function compareNavbarContainers(
  left: NavbarContainerAlertGroupReadModel,
  right: NavbarContainerAlertGroupReadModel,
): number {
  const bySeverity = compareSeverityDesc(left.dominantSeverity, right.dominantSeverity)
  if (bySeverity !== 0) return bySeverity

  const byCount = right.activeAlertsCount - left.activeAlertsCount
  if (byCount !== 0) return byCount

  const byRecency = compareIsoDesc(left.latestAlertAt, right.latestAlertAt)
  if (byRecency !== 0) return byRecency

  return left.containerNumber.localeCompare(right.containerNumber)
}

function compareNavbarProcesses(
  left: NavbarProcessAlertGroupReadModel,
  right: NavbarProcessAlertGroupReadModel,
): number {
  const bySeverity = compareSeverityDesc(left.dominantSeverity, right.dominantSeverity)
  if (bySeverity !== 0) return bySeverity

  const byCount = right.activeAlertsCount - left.activeAlertsCount
  if (byCount !== 0) return byCount

  const byRecency = compareIsoDesc(left.latestAlertAt, right.latestAlertAt)
  if (byRecency !== 0) return byRecency

  const leftReference = left.processReference?.trim().toUpperCase() ?? '~'
  const rightReference = right.processReference?.trim().toUpperCase() ?? '~'
  if (leftReference !== rightReference) {
    return leftReference.localeCompare(rightReference)
  }

  return left.processId.localeCompare(right.processId)
}

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
      const process = context?.process
      const processReference = process?.reference ?? null
      const carrier = resolveCarrier(process)
      const routeSummary = toRouteSummary(process?.origin ?? null, process?.destination ?? null)

      const processAccumulator = (() => {
        const existing = processAccumulatorsById.get(alert.process_id)
        if (existing) return existing

        const created: MutableProcessAccumulator = {
          processId: alert.process_id,
          processReference,
          carrier,
          routeSummary,
          containersById: new Map(),
        }
        processAccumulatorsById.set(alert.process_id, created)
        return created
      })()

      const containerFromContext = context?.containersById.get(alert.container_id)
      const containerSummary = containerOperationalById.get(alert.container_id)
      const containerAccumulator = (() => {
        const existing = processAccumulator.containersById.get(alert.container_id)
        if (existing) return existing

        const created: MutableContainerAccumulator = {
          containerId: alert.container_id,
          containerNumber: containerFromContext?.containerNumber ?? alert.container_id,
          status: containerSummary?.status ?? null,
          eta: containerSummary?.eta?.eventTimeIso ?? null,
          alerts: [],
        }
        processAccumulator.containersById.set(alert.container_id, created)
        return created
      })()

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
