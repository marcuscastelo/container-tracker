import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'

export function resolveLifecycleState(alert: AlertDisplayVM): 'ACTIVE' | 'ACKED' | 'AUTO_RESOLVED' {
  if (alert.lifecycleState === 'ACTIVE') return 'ACTIVE'
  if (alert.lifecycleState === 'ACKED') return 'ACKED'
  if (alert.lifecycleState === 'AUTO_RESOLVED') return 'AUTO_RESOLVED'
  if (alert.ackedAtIso) return 'ACKED'
  if (alert.resolvedAtIso) return 'AUTO_RESOLVED'
  return 'ACTIVE'
}
