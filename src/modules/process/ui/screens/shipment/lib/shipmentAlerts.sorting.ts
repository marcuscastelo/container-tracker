import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'

function resolveLifecycleState(alert: AlertDisplayVM): 'ACTIVE' | 'ACKED' | 'AUTO_RESOLVED' {
  if (alert.lifecycleState === 'ACTIVE') return 'ACTIVE'
  if (alert.lifecycleState === 'ACKED') return 'ACKED'
  if (alert.lifecycleState === 'AUTO_RESOLVED') return 'AUTO_RESOLVED'
  if (alert.ackedAtIso) return 'ACKED'
  if (alert.resolvedAtIso) return 'AUTO_RESOLVED'
  return 'ACTIVE'
}

function compareAlertsByTriggeredAtDesc(left: AlertDisplayVM, right: AlertDisplayVM): number {
  const triggeredAtCompare = right.triggeredAtIso.localeCompare(left.triggeredAtIso)
  if (triggeredAtCompare !== 0) return triggeredAtCompare
  return right.id.localeCompare(left.id)
}

function compareAlertsByAckedAtDesc(left: AlertDisplayVM, right: AlertDisplayVM): number {
  const leftAckedAt = left.ackedAtIso ?? left.resolvedAtIso ?? ''
  const rightAckedAt = right.ackedAtIso ?? right.resolvedAtIso ?? ''
  const ackedAtCompare = rightAckedAt.localeCompare(leftAckedAt)
  if (ackedAtCompare !== 0) return ackedAtCompare
  return right.id.localeCompare(left.id)
}

export function toSortedActiveAlerts(alerts: readonly AlertDisplayVM[]): readonly AlertDisplayVM[] {
  return [...alerts]
    .filter((alert) => resolveLifecycleState(alert) === 'ACTIVE')
    .sort(compareAlertsByTriggeredAtDesc)
}

export function toSortedArchivedAlerts(
  alerts: readonly AlertDisplayVM[],
): readonly AlertDisplayVM[] {
  return [...alerts]
    .filter((alert) => resolveLifecycleState(alert) !== 'ACTIVE')
    .sort(compareAlertsByAckedAtDesc)
}
