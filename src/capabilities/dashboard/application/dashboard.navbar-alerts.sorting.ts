import type {
  DashboardNavbarSeverity,
  NavbarAlertItemReadModel,
  NavbarContainerAlertGroupReadModel,
  NavbarProcessAlertGroupReadModel,
} from '~/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel.shared'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import { parseInstantFromIso } from '~/shared/time/parsing'

const DASHBOARD_NAVBAR_SEVERITY_ORDER: Readonly<Record<DashboardNavbarSeverity, number>> = {
  none: 0,
  success: 1,
  info: 2,
  warning: 3,
  danger: 4,
}

export function toRouteSummary(origin: string | null, destination: string | null): string {
  const normalizedOrigin = origin?.trim() ?? ''
  const normalizedDestination = destination?.trim() ?? ''
  return `${normalizedOrigin.length > 0 ? normalizedOrigin : '—'} → ${normalizedDestination.length > 0 ? normalizedDestination : '—'}`
}

function toTimestampOrNegativeInfinity(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY
  return parseInstantFromIso(value)?.toEpochMs() ?? Number.NEGATIVE_INFINITY
}

export function compareIsoDesc(left: string | null, right: string | null): number {
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

export function toNavbarSeverity(
  severity: TrackingActiveAlertReadModel['severity'],
): DashboardNavbarSeverity {
  if (severity === 'danger') return 'danger'
  if (severity === 'warning') return 'warning'
  if (severity === 'info') return 'info'
  return 'none'
}

export function compareSeverityDesc(
  left: DashboardNavbarSeverity,
  right: DashboardNavbarSeverity,
): number {
  return DASHBOARD_NAVBAR_SEVERITY_ORDER[right] - DASHBOARD_NAVBAR_SEVERITY_ORDER[left]
}

export function resolveDominantSeverity(
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

export function resolveLatestAlertAt(alerts: readonly NavbarAlertItemReadModel[]): string | null {
  if (alerts.length === 0) return null

  let latest = alerts[0].occurredAt
  for (const alert of alerts) {
    if (compareIsoDesc(latest, alert.occurredAt) > 0) {
      latest = alert.occurredAt
    }
  }
  return latest
}

export function compareNavbarAlertItems(
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

export function compareNavbarContainers(
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

export function compareNavbarProcesses(
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
